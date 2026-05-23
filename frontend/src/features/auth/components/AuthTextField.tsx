import type { ChangeEvent } from "react";

interface Props {
  id: string;
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
}

export function AuthTextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  disabled,
  autoComplete,
  placeholder,
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
