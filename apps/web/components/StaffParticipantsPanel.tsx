"use client";
import { useI18n } from "@/components/I18nProvider";

import type { ReactNode } from "react";
import type { ParticipantRole } from "@/lib/participant-role";

export type StaffParticipantView = {
  identity: string;
  name: string;
  role: ParticipantRole;
  self: boolean;
  preview?: ReactNode;
};

export function StaffParticipantsPanel({ participants }: { participants: StaffParticipantView[] }) {
  const { t } = useI18n();
  return <div className="panel studio-staff-panel">
    <h2>{t("Администраторы и модераторы")}</h2>
    {participants.length ? <div className="studio-staff-list">
      {participants.map(participant => <div className="studio-staff-row" key={participant.identity}>
        {!participant.self && participant.preview}
        <span className="studio-staff-name">{participant.name}{participant.self && <small>{t("Вы")}</small>}</span>
        <span className={`studio-participant-role studio-participant-role-${participant.role}`}>
          {participant.role === "admin" ? t("Администратор") : t("Модератор")}
        </span>
      </div>)}
    </div> : <p className="muted">{t("Администраторы и модераторы пока не подключены.")}</p>}
  </div>;
}
