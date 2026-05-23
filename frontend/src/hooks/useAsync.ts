import { useState } from "react";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });

  function execute(fn: () => Promise<T>): void {
    setState({ status: "loading" });
    fn()
      .then((data) => setState({ status: "success", data }))
      .catch((err: unknown) => setState({ status: "error", error: getApiErrorMessage(err) }));
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { ...state, execute, reset };
}
