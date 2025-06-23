import { useState } from 'react';
import styles from './CopyButton.module.css';

interface CopyButtonProps {
  textToCopy: string;
  buttonText?: string;
  successText?: string;
  className?: string;
}

export function CopyButton({
  textToCopy,
  buttonText = "コピー",
  successText = "コピーしました！",
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text: ", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`${styles.copyButton} ${copied ? styles.copyButtonSuccess : ''} ${className}`}
    >
      {copied ? successText : buttonText}
    </button>
  );
}