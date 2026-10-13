export type RecoveryPhase = "connecting" | "connected" | "reconnecting" | "recovered" | "failed";

export type RecoveryStatus = {
  phase: RecoveryPhase;
  message: string;
};

export type RecoveryEvent = "connect-start" | "connect-success" | "reconnecting" | "reconnected" | "failed";

export const initialRecoveryStatus = (): RecoveryStatus => ({
  phase: "connecting",
  message: "Подключение к комнате…",
});

export function nextRecoveryStatus(current: RecoveryStatus, event: RecoveryEvent, failureMessage = ""): RecoveryStatus {
  switch (event) {
    case "connect-start":
      return { phase: "connecting", message: "Подключение к комнате…" };
    case "connect-success":
      return { phase: "connected", message: "" };
    case "reconnecting":
      return { phase: "reconnecting", message: "Восстанавливаем соединение…" };
    case "reconnected":
      return { phase: "recovered", message: "Соединение восстановлено." };
    case "failed":
      return { phase: "failed", message: failureMessage || "Не удалось восстановить соединение." };
    default:
      return current;
  }
}

export function recoveryBadge(phase: RecoveryPhase) {
  switch (phase) {
    case "connecting": return "Подключение";
    case "reconnecting": return "Переподключение";
    case "recovered": return "Восстановлено";
    case "failed": return "Нет связи";
    default: return "Онлайн";
  }
}
