import { confirm } from "@tauri-apps/plugin-dialog";

type NativeConfirmLabels = {
  cancelLabel: string;
  message: string;
  okLabel: string;
};

export async function confirmNativeAiAgentSessionDelete(sessionTitle: string, labels: NativeConfirmLabels) {
  return confirm(labels.message, {
    cancelLabel: labels.cancelLabel,
    kind: "warning",
    okLabel: labels.okLabel,
    title: sessionTitle
  });
}
