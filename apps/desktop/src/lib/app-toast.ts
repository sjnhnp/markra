import { toast } from "sonner";

export type AppToastStatus = "error" | "success";

export const defaultAppToastId = "app-toast";

export function showAppToast({
  id = defaultAppToastId,
  message,
  status
}: {
  id?: string;
  message: string;
  status: AppToastStatus;
}) {
  const options = {
    duration: status === "error" ? Infinity : 4500,
    id
  };

  if (status === "error") {
    toast.error(message, options);
    return;
  }

  toast.success(message, options);
}

export function dismissAppToast(id = defaultAppToastId) {
  toast.dismiss(id);
}
