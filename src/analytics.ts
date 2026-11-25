type Params = Record<string, string | number | boolean>;
type Metrika = (id: number, method: "reachGoal", goal: string, params: Params) => void;

// Идентификатор реального счётчика Яндекс Метрики проекта
const COUNTER_ID = 114661702;

export function track(event: string, params: Params = {}): void {
  const data = { ...params, game_version: "1.3.0" };

  if (import.meta.env.DEV) {
    console.log("[analytics]", event, data);
  }

  const ym = (window as Window & { ym?: Metrika }).ym;
  if (typeof ym === "function") {
    try {
      ym(COUNTER_ID, "reachGoal", event, data);
    } catch (error) {
      console.warn("Analytics error", error);
    }
  }
}
