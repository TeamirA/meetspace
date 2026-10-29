import { File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo } from "lucide-react";

export function FileTypeIcon({ type, name, className }: { type: string; name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = type.startsWith("image/")
    ? FileImage
    : type.startsWith("video/")
      ? FileVideo
      : type.startsWith("audio/")
        ? FileAudio
        : /zip|rar|7z|tar|gz/.test(ext)
          ? FileArchive
          : /csv|xls|xlsx|numbers/.test(ext)
            ? FileSpreadsheet
            : /js|ts|tsx|py|json|html|css|java|go|rs|rb|sh/.test(ext)
              ? FileCode
              : /pdf|doc|docx|txt|md|rtf|pages|ppt|pptx|key/.test(ext)
                ? FileText
                : File;
  return <Icon className={className} />;
}
