"use client";

import { useState } from "react";

/** Copy the template to the clipboard, or download it as a .md file. */
export default function CopyTemplate({
  markdown,
  filename,
}: {
  markdown: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tpl-actions">
      <button type="button" className="btn btn-ink" onClick={copy}>
        {copied ? "Copied" : "Copy as Markdown"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={download}>
        Download .md
      </button>
    </div>
  );
}
