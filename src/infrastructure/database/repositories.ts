import type {
  ChatMessageRepository,
  MeetingRepository,
  ParticipantRepository,
  RateLimitRepository,
  RefreshTokenRepository,
  SharedFileRepository,
  UserRepository,
  WhiteboardRepository,
} from "@/core/domain/repositories";
import type { BoardElement, User, UserPreferences } from "@/core/domain/entities";
import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

type UserRow = Omit<User, "preferences"> & { preferences: Prisma.JsonValue };
const toUser = (row: UserRow): User => ({
  ...row,
  preferences: (row.preferences ?? {}) as UserPreferences,
});

/** `schema` must match the one given to the Prisma adapter; raw SQL doesn't inherit it. */
export function createRepositories(db: Db, schema = "public") {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Invalid schema name");
  const bucketsTable = Prisma.raw(`"${schema}".rate_limit_buckets`);

  const users: UserRepository = {
    async findById(id) {
      const row = await db.user.findUnique({ where: { id } });
      return row && toUser(row);
    },
    async findByEmail(email) {
      const row = await db.user.findUnique({ where: { email } });
      return row && toUser(row);
    },
    async create(data) {
      return toUser(await db.user.create({ data }));
    },
    async update(id, patch) {
      const { preferences, ...rest } = patch;
      const row = await db.user.update({
        where: { id },
        data: { ...rest, ...(preferences && { preferences: preferences as Prisma.InputJsonValue }) },
      });
      return toUser(row);
    },
  };

  const refreshTokens: RefreshTokenRepository = {
    create: (data) => db.refreshToken.create({ data }),
    findByHash: (tokenHash) => db.refreshToken.findUnique({ where: { tokenHash } }),
    async markReplaced(id, replacedBy) {
      await db.refreshToken.update({ where: { id }, data: { replacedBy, revokedAt: new Date() } });
    },
    async revokeFamily(familyId) {
      await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    },
    async revokeAllForUser(userId) {
      await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    },
  };

  const rateLimits: RateLimitRepository = {
    async hit(key, windowMs) {
      // Single atomic statement: reset the window if expired, otherwise increment.
      const rows = await db.$queryRaw<{ count: number; reset_at: Date }[]>`
        INSERT INTO ${bucketsTable} (key, count, reset_at)
        VALUES (${key}, 1, now() + (${windowMs} * interval '1 millisecond'))
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN rate_limit_buckets.reset_at < now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
          reset_at = CASE WHEN rate_limit_buckets.reset_at < now()
                          THEN now() + (${windowMs} * interval '1 millisecond')
                          ELSE rate_limit_buckets.reset_at END
        RETURNING count, reset_at`;
      return { count: Number(rows[0].count), resetAt: rows[0].reset_at };
    },
    async reset(key) {
      await db.rateLimitBucket.deleteMany({ where: { key } });
    },
  };

  const memberFilter = (userId: string): Prisma.MeetingWhereInput => ({
    OR: [{ hostId: userId }, { participants: { some: { userId, status: { in: ["ADMITTED", "LEFT"] } } } }],
  });

  const meetings: MeetingRepository = {
    create: (data) => db.meeting.create({ data }),
    findByCode: (code) => db.meeting.findUnique({ where: { code } }),
    findById: (id) => db.meeting.findUnique({ where: { id } }),
    update: (id, patch) => db.meeting.update({ where: { id }, data: patch }),
    listUpcomingForUser: (userId, now, limit) =>
      db.meeting.findMany({
        where: {
          AND: [
            memberFilter(userId),
            { status: { not: "ENDED" } },
            {
              OR: [
                { scheduledFor: { gte: new Date(now.getTime() - 60 * 60_000) } },
                { scheduledFor: null, status: "LIVE", endedAt: null },
              ],
            },
          ],
        },
        orderBy: [{ scheduledFor: { sort: "asc", nulls: "first" } }],
        take: limit,
      }),
    listRecentForUser: (userId, limit) =>
      db.meeting.findMany({
        where: { AND: [memberFilter(userId), { startedAt: { not: null } }] },
        orderBy: { startedAt: "desc" },
        take: limit,
      }),
    listHistoryForUser: (userId, limit, cursor) =>
      db.meeting.findMany({
        where: { AND: [memberFilter(userId), { startedAt: { not: null } }] },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        take: limit,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      }),
    async delete(id) {
      await db.meeting.delete({ where: { id } });
    },
  };

  const participants: ParticipantRepository = {
    findById: (id) => db.participant.findUnique({ where: { id } }),
    findByMeetingAndUser: (meetingId, userId) =>
      db.participant.findUnique({ where: { meetingId_userId: { meetingId, userId } } }),
    listByMeeting: (meetingId, statuses) =>
      db.participant.findMany({
        where: { meetingId, ...(statuses && { status: { in: statuses } }) },
        orderBy: { createdAt: "asc" },
      }),
    countActive: (meetingId, since) =>
      db.participant.count({ where: { meetingId, status: "ADMITTED", lastSeenAt: { gte: since } } }),
    create: (data) => db.participant.create({ data }),
    update: (id, patch) => db.participant.update({ where: { id }, data: patch }),
    async markAllLeft(meetingId, at) {
      await db.participant.updateMany({
        where: { meetingId, leftAt: null, status: "ADMITTED" },
        data: { leftAt: at, lastSeenAt: null },
      });
      await db.participant.updateMany({ where: { meetingId, status: "WAITING" }, data: { status: "LEFT" } });
    },
  };

  const messages: ChatMessageRepository = {
    create: (data) => db.chatMessage.create({ data }),
    async listByMeeting(meetingId, limit, before) {
      const rows = await db.chatMessage.findMany({
        where: { meetingId, ...(before && { createdAt: { lt: before } }) },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.reverse();
    },
  };

  const files: SharedFileRepository = {
    create: (data) => db.sharedFile.create({ data }),
    findById: (id) => db.sharedFile.findUnique({ where: { id } }),
    markUploaded: (id) => db.sharedFile.update({ where: { id }, data: { uploaded: true } }),
    listByMeeting: (meetingId) => db.sharedFile.findMany({ where: { meetingId }, orderBy: { createdAt: "asc" } }),
    async delete(id) {
      await db.sharedFile.delete({ where: { id } });
    },
  };

  const whiteboards: WhiteboardRepository = {
    async find(meetingId) {
      const row = await db.whiteboard.findUnique({ where: { meetingId } });
      return row && { ...row, elements: row.elements as unknown as BoardElement[] };
    },
    async save(meetingId, elements) {
      const json = elements as unknown as Prisma.InputJsonValue;
      const row = await db.whiteboard.upsert({
        where: { meetingId },
        create: { meetingId, elements: json, version: 1 },
        update: { elements: json, version: { increment: 1 } },
      });
      return { ...row, elements: row.elements as unknown as BoardElement[] };
    },
  };

  return { users, refreshTokens, rateLimits, meetings, participants, messages, files, whiteboards };
}
