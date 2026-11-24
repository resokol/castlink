"use client";
import { useI18n } from "./I18nProvider";
import type { NodeKeyframes } from "../lib/node-keyframes";
import type { MinuteEvidence } from "../lib/incident-minute";

export function IncidentMinuteEvidence({ evidence, name }: { evidence: MinuteEvidence; name: (id: string) => string }) {
  const { t, locale } = useI18n();
  const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString(locale, { maximumFractionDigits: 1 });
  const keyframes = (sample: NodeKeyframes | undefined, direction: "incoming" | "outgoing") => {
    const count = sample?.[direction];
    if (!sample || count == null) return "—";
    const rate = 1000 * count / (sample.at - sample.from);
    return t("{count} · {rate} кадр/с", { count: fmt(count), rate: rate.toLocaleString(locale, { maximumFractionDigits: 2 }) });
  };
  const time = (at: number) => new Date(at).toLocaleTimeString(locale);
  const { paths, clients, node, slots } = evidence;
  const slotCount = (value: number) => value + " / " + slots;
  const ordered = [...paths].sort((a, b) => a.publisher.localeCompare(b.publisher) || a.kind.localeCompare(b.kind) ||
    a.source.localeCompare(b.source) || (a.track ?? "").localeCompare(b.track ?? "") || (a.receiver ?? "").localeCompare(b.receiver ?? ""));
  return <div className="stats-table-wrap">
    <h3>{t("Пути медиапотоков")}</h3>
    <p className="muted">{t("Показаны максимумы за минуту. Покрытие — число пятисекундных интервалов с замерами. Прочерк означает, что метрика отсутствует.")}</p>
    {!!paths.length && <table className="stats-table"><thead><tr>
      <th>{t("Отправитель")}</th><th>{t("Трек")}</th><th>{t("Точка измерения")}</th>
      <th>{t("кбит/с")}</th><th>{t("Потери, %")}</th><th>{t("Джиттер, мс")}</th><th>{t("Покрытие")}</th>
    </tr></thead><tbody>{ordered.map((path, index) => <tr key={index}>
      <td>{name(path.publisher)}</td><td>{t(path.kind === "audio" ? "Аудио" : "Видео")} · {path.source}<small>{path.track}</small></td>
      <td>{path.receiver ? name(path.receiver) : t("Отправка на SFU")}<small>{path.session}</small></td>
      <td>{fmt(path.peakKbps)}</td><td>{fmt(path.peakLossPct)}</td><td>{fmt(path.peakJitterMs)}</td><td>{slotCount(path.slotsObserved)}</td>
    </tr>)}</tbody></table>}
    {(!paths.some(path => !path.receiver) || !paths.some(path => path.receiver)) &&
      <p>{t("Для сравнения нужны замеры отправки и приёма одного трека. Проверьте фильтры и соседнюю минуту.")}</p>}
    <h3>{t("Доступность клиентов")}</h3>
    {!!clients.length && <table className="stats-table"><thead><tr>
      <th>{t("Участник")}</th><th>{t("Состояния соединения")}</th><th>{t("Переподключения за минуту")}</th><th>{t("Время замеров")}</th><th>{t("Покрытие")}</th>
    </tr></thead><tbody>{clients.map(client => <tr key={JSON.stringify([client.identity, client.session])}>
      <td>{name(client.identity)}<small>{client.session}</small></td><td>{client.states.join(", ") || "—"}</td>
      <td>{fmt(client.reconnectDelta)}</td><td>{time(client.firstAt)} – {time(client.lastAt)}</td><td>{slotCount(client.slotsObserved)}</td>
    </tr>)}</tbody></table>}
    {!clients.length && <p>{t("За эту минуту клиенты не прислали замеров.")}</p>}
    {evidence.limited && <p>{t("Достигнут лимит строк сравнения. Сузьте фильтр или скачайте исходные замеры.")}</p>}
    <h3>{t("Медиасервер за минуту")}</h3>
    {node.reason === "platform-access-required" ? <p>{t("Измерения по всей ноде доступны администратору платформы.")}</p> :
      !node.samples.length ? <p>{t("Нет сохранённых проверок медиасервера за эту минуту.")}</p> :
      <>
        <p className="muted">{t("Проверка службы относится к API LiveKit. Ключевые кадры подсчитаны по всем комнатам ноды за указанный интервал.")}</p>
        <table className="stats-table"><thead><tr><th>{t("Проверка API")}</th><th>{t("Интервал счётчиков")}</th>
          <th>{t("Ключевых кадров принято")}</th><th>{t("Ключевых кадров переслано")}</th></tr></thead><tbody>
          {node.samples.map(sample => <tr key={sample.at}><td>{time(sample.at)} · {t(sample.livekit === "ok" ? "Доступен" : sample.livekit === "unconfigured" ? "Не настроен" : "Проверка не прошла")}</td>
            <td>{sample.keyframes ? time(sample.keyframes.from) + " – " + time(sample.keyframes.at) : "—"}</td>
            <td>{keyframes(sample.keyframes, "incoming")}</td><td>{keyframes(sample.keyframes, "outgoing")}</td></tr>)}
        </tbody></table>
        {node.samples.every(sample => !sample.keyframes) && <p>{t("Нет сопоставимых счётчиков ключевых кадров. Проверьте внутренний сбор метрик и соседнюю минуту.")}</p>}
        {node.samples.some(sample => sample.livekit === "unavailable") && <p>{t("Проверьте журнал LiveKit за время неуспешной проверки API.")}</p>}
      </>}
  </div>;
}
