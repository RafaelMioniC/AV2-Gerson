/** Aceita somente YYYY-MM-DD ou timestamp ISO 8601 completo; rejeita anos isolados e datas de calendário impossíveis. */
export function parseDataIsoEstrita(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(valor)) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  const [ano, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  if (new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) !== valor.slice(0, 10)) return null;
  return data;
}
