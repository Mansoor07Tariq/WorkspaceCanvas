import { useState } from "react";

export function useForm<T extends Record<keyof T, string>>(initial: T) {
  const [fields, setFields] = useState<T>(initial);

  function setField(name: keyof T, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }) as T);
  }

  function reset() {
    setFields(initial);
  }

  return { fields, setField, reset };
}
