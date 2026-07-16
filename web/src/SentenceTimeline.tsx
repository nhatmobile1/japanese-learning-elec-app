import type { Entry } from './types';

function byMonth(entries: Entry[]): { month: string; items: Entry[] }[] {
  const groups: { month: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const month = e.source_ref.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  return groups;
}

export default function SentenceTimeline({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return <p className="empty">No sentences yet</p>;
  return (
    <div className="timeline">
      {byMonth(entries).map((g) => (
        <section key={g.month}>
          <h2 className="month-header">
            {g.month}
          </h2>
          <ul>
            {g.items.map((e) => (
              <li key={e.id} className="occurrence">
                <span className="badge date">{e.source_ref}</span>
                <span className="entry-raw">{e.raw}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
