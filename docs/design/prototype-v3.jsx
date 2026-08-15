import { useState } from "react";
import {
  Armchair, DoorOpen, Map as MapIcon, CalendarDays, Users, Sparkles,
  ChevronDown, Check, ArrowUpRight, Building2, Search, ArrowLeft, X
} from "lucide-react";

// ─── WorkspaceCanvas tokens ────────────────────────────────────────────────
const C = {
  page: "#F4F6F5", card: "#FFFFFF", ink: "#182420", slate: "#5E6B66",
  mist: "#EAEFED", pine: "#147054", pineDark: "#0C4A38",
  mint: "#E2F2EA", mintLine: "#BFE3D2", amber: "#B97A24",
  line: "#E4E9E7", shadow: "0 1px 2px rgba(24,36,32,.04), 0 4px 14px rgba(24,36,32,.05)",
};
const fD = { fontFamily: "'Fraunces', Georgia, serif" };
const fB = { fontFamily: "'Manrope', 'Segoe UI', system-ui, sans-serif" };

const PEOPLE = [
  { i: "SK", n: "Sarah Kelly", team: "Engineering", c: "#147054" },
  { i: "TB", n: "Tom Byrne", team: "Engineering", c: "#7A5AA6" },
  { i: "AN", n: "Aoife Nolan", team: "Design", c: "#B97A24" },
  { i: "JM", n: "James Murphy", team: "Sales", c: "#3A6EA5" },
  { i: "RD", n: "Rita Doyle", team: "Engineering", c: "#A5544F" },
  { i: "LP", n: "Liam Power", team: "Ops", c: "#4E7D3A" },
  { i: "EW", n: "Emma Walsh", team: "Design", c: "#8A6FB8" },
  { i: "DK", n: "Dan Kealy", team: "Sales", c: "#2E7D74" },
];

const DAYS = [
  { d: "Mon", n: 10, you: 14, occ: { 13: 1, 15: 3, 18: 0, 21: 4, 25: 6, 27: 7 } },
  { d: "Tue", n: 11, you: 14, occ: { 13: 2, 17: 0, 26: 5 } },
  { d: "Wed", n: 12, you: null, occ: { 12: 1, 18: 2, 22: 3 } },
  { d: "Thu", n: 13, you: null, occ: { 12: 0, 13: 1, 15: 2, 21: 4, 26: 5, 27: 6 } },
  { d: "Fri", n: 14, you: "remote", occ: { 18: 3 } },
];

const FLOORS = [
  { name: "Floor 1", note: "reception · kitchen" },
  { name: "Floor 2", note: "your team's floor" },
  { name: "Floor 3", note: "quiet floor" },
];

const DESKS = [
  { id: 12, x: 128, y: 26 }, { id: 13, x: 172, y: 26 }, { id: 14, x: 216, y: 26, usual: true }, { id: 15, x: 260, y: 26 },
  { id: 16, x: 128, y: 64 }, { id: 17, x: 172, y: 64 }, { id: 18, x: 216, y: 64 }, { id: 19, x: 260, y: 64 },
  { id: 20, x: 128, y: 128 }, { id: 21, x: 172, y: 128 }, { id: 22, x: 216, y: 128 }, { id: 23, x: 260, y: 128 }, { id: 24, x: 310, y: 128 },
  { id: 25, x: 128, y: 186 }, { id: 26, x: 172, y: 186 }, { id: 27, x: 216, y: 186 },
];

// distance from your usual desk (14) for the "near you" ranking
const near = id => {
  const a = DESKS.find(d => d.id === 14), b = DESKS.find(d => d.id === id);
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const Avatar = ({ p, size = 30, ring }) => (
  <span title={p.n} style={{
    width: size, height: size, background: p.c, color: "#fff", ...fB,
    fontSize: size * 0.36, fontWeight: 700, borderRadius: "38%",
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    boxShadow: ring ? `0 0 0 2px ${C.card}` : "none",
  }}>{p.i}</span>
);

const Btn = ({ primary, children, onClick, style }) => (
  <button onClick={onClick} style={{
    ...fB, fontSize: 13.5, fontWeight: 700, padding: "10px 18px", borderRadius: 10,
    cursor: "pointer", transition: "transform .1s",
    background: primary ? C.pine : "transparent", color: primary ? "#fff" : C.ink,
    border: primary ? "none" : `1px solid ${C.line}`, ...style,
  }}
    onMouseDown={e => e.currentTarget.style.transform = "scale(.97)"}
    onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
  >{children}</button>
);

// ─── Day-aware floor map ───────────────────────────────────────────────────
function LiveMap({ dayIdx, highlightPerson, onDeskClick, big }) {
  const day = DAYS[dayIdx];
  const s = big ? 1.35 : 1;
  return (
    <svg viewBox="0 0 380 246" style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x={5} y={5} width={370} height={236} rx={14} fill={C.card} stroke={C.line} strokeWidth={1.5} />
      <rect x={20} y={22} width={92} height={64} rx={9} fill={C.mist} />
      <text x={66} y={57} textAnchor="middle" style={{ ...fB, fontSize: 9.5, fontWeight: 700 }} fill={C.slate}>MEETING ROOM</text>
      <rect x={20} y={118} width={92} height={54} rx={9} fill={C.mist} />
      <text x={66} y={149} textAnchor="middle" style={{ ...fB, fontSize: 9.5, fontWeight: 700 }} fill={C.slate}>FOCUS POD</text>
      <rect x={20} y={190} width={92} height={34} rx={9} fill="none" stroke={C.line} strokeDasharray="4 4" />
      <text x={66} y={210} textAnchor="middle" style={{ ...fB, fontSize: 9, fontWeight: 600 }} fill={C.slate}>kitchen</text>
      {DESKS.map(dk => {
        const pIdx = day.occ[dk.id];
        const isYou = day.you === dk.id;
        const taken = pIdx !== undefined;
        const dim = highlightPerson != null && pIdx !== highlightPerson && !isYou;
        const fill = isYou ? C.pine : taken ? C.card : C.mint;
        const stroke = isYou ? C.pineDark : taken ? PEOPLE[pIdx].c : C.mintLine;
        return (
          <g key={dk.id} opacity={dim ? 0.22 : 1} style={{ transition: "opacity .2s", cursor: onDeskClick ? "pointer" : "default" }}
            onClick={e => { e.stopPropagation(); onDeskClick && onDeskClick(dk.id); }}>
            <rect x={dk.x} y={dk.y} width={38} height={27} rx={7} fill={fill}
              stroke={stroke} strokeWidth={isYou ? 2 : taken ? 1.6 : 1.2} />
            {taken && !isYou && (<>
              <circle cx={dk.x + 12} cy={dk.y + 13.5} r={8.5} fill={PEOPLE[pIdx].c} />
              <text x={dk.x + 12} y={dk.y + 16.5} textAnchor="middle" style={{ ...fB, fontSize: 7.5, fontWeight: 800 }} fill="#fff">{PEOPLE[pIdx].i}</text>
              <text x={dk.x + 28} y={dk.y + 17} textAnchor="middle" style={{ ...fB, fontSize: 8.5, fontWeight: 700 }} fill={C.slate}>{dk.id}</text>
            </>)}
            {isYou && <text x={dk.x + 19} y={dk.y + 17.5} textAnchor="middle" style={{ ...fB, fontSize: 9.5, fontWeight: 800 }} fill="#fff">You</text>}
            {!taken && !isYou && (<>
              <text x={dk.x + 19} y={dk.y + 17.5} textAnchor="middle" style={{ ...fB, fontSize: 10, fontWeight: 700 }} fill={C.pineDark}>{dk.id}</text>
              {dk.usual && <circle cx={dk.x + 33} cy={dk.y + 5} r={3.5} fill={C.amber} />}
            </>)}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Screen: Today (v3) ────────────────────────────────────────────────────
function TodayScreen({ go }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [floor, setFloor] = useState(1);
  const day = DAYS[dayIdx];
  const inDay = Object.entries(day.occ); // [deskId, personIdx]
  const youBooked = typeof day.you === "number";
  const freeCount = DESKS.length - inDay.length - (youBooked ? 1 : 0);
  const nearby = [...inDay].sort((a, b) => near(+a[0]) - near(+b[0])).slice(0, 3);
  const extra = inDay.length - nearby.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ ...fD, fontSize: 32, fontWeight: 500, margin: 0, color: C.ink, letterSpacing: "-0.01em" }}>Good morning, Mansoor</p>
          <p style={{ ...fB, fontSize: 14, color: C.slate, margin: "6px 0 0" }}>Monday, August 10</p>
        </div>
        <button style={{ ...fB, display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "9px 14px", cursor: "pointer", boxShadow: C.shadow }}>
          <Building2 size={16} color={C.pine} />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>Dublin HQ</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, background: C.mint, color: C.pineDark, padding: "2px 8px", borderRadius: 99 }}>DEFAULT</span>
          <ChevronDown size={14} color={C.slate} />
        </button>
      </div>

      {/* MAP HERO */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, overflow: "hidden", boxShadow: C.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
            {FLOORS.map((f, i) => (
              <button key={f.name} onClick={() => setFloor(i)} style={{
                ...fB, flexShrink: 0, cursor: "pointer", padding: "7px 14px", borderRadius: 999,
                border: `1px solid ${floor === i ? C.pine : C.line}`, fontSize: 12.5, fontWeight: 800,
                background: floor === i ? C.mint : "transparent", color: floor === i ? C.pineDark : C.slate,
              }}>{f.name}</button>
            ))}
          </div>
          <button onClick={() => go("floor")} style={{ ...fB, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: C.pine, background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>
            View full floor <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 196px" }}>
          <div style={{ padding: "12px 6px 8px 14px", cursor: "pointer" }} onClick={() => go("book")} title="Book a desk for this day">
            {floor === 1 ? <LiveMap dayIdx={dayIdx} onDeskClick={() => go("book")} /> : (
              <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: C.slate, ...fB }}>
                <MapIcon size={26} /><span style={{ fontSize: 13, fontWeight: 700 }}>{FLOORS[floor].name} — same live view</span>
              </div>
            )}
          </div>
          <div style={{ borderLeft: `1px solid ${C.line}`, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
            <p style={{ ...fB, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: C.slate, margin: "0 0 10px" }}>NEAR YOU · {day.d.toUpperCase()}</p>
            {nearby.map(([deskId, pi]) => (
              <div key={pi} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <Avatar p={PEOPLE[pi]} size={27} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...fB, fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{PEOPLE[pi].n}</p>
                  <p style={{ ...fB, fontSize: 11, color: C.slate, margin: 0 }}>Desk {deskId}</p>
                </div>
              </div>
            ))}
            {inDay.length === 0 && <p style={{ ...fB, fontSize: 12.5, color: C.slate }}>Nobody yet — be the first in.</p>}
            {extra > 0 && (
              <button onClick={() => go("floor")} style={{ ...fB, fontSize: 12, fontWeight: 800, color: C.pine, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0, marginTop: 2 }}>
                +{extra} more in the office →
              </button>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 11 }}>
              {youBooked ? (
                <p style={{ ...fB, fontSize: 12.5, fontWeight: 700, color: C.pineDark, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} strokeWidth={3} color={C.pine} /> You're at Desk {day.you}
                </p>
              ) : day.you === "remote" ? (
                <p style={{ ...fB, fontSize: 12.5, fontWeight: 700, color: C.slate, margin: 0 }}>You're remote on {day.d}</p>
              ) : (
                <Btn primary style={{ width: "100%", padding: "9px 0", fontSize: 12.5 }} onClick={() => go("book")}>Book for {day.d} · {freeCount} free</Btn>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* week strip */}
      <p style={{ ...fB, fontSize: 13, fontWeight: 800, color: C.ink, margin: "22px 0 10px" }}>
        Your week <span style={{ fontWeight: 600, color: C.slate }}>· tap a day to preview it above</span>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {DAYS.map((w, idx) => {
          const active = idx === dayIdx;
          const empty = w.you === null;
          const remote = w.you === "remote";
          const booked = typeof w.you === "number";
          const ppl = Object.values(w.occ);
          return (
            <div key={w.d} onClick={() => setDayIdx(idx)} style={{
              background: active && booked ? C.pine : C.card,
              border: `1.5px solid ${active ? C.pine : C.line}`,
              outline: empty && !active ? `1.5px dashed ${C.line}` : "none",
              borderRadius: 14, padding: "12px 12px 10px", cursor: "pointer", transition: "transform .12s",
              boxShadow: active ? C.shadow : "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ ...fD, fontSize: 19, color: active && booked ? "#fff" : C.ink }}>{w.n}</span>
                <span style={{ ...fB, fontSize: 11, fontWeight: 700, color: active && booked ? "#CBE8DB" : C.slate }}>{w.d}</span>
              </div>
              <p style={{ ...fB, fontSize: 12.5, fontWeight: 700, margin: "7px 0 9px", color: active && booked ? "#fff" : remote ? C.slate : empty ? C.pine : C.ink }}>
                {remote ? "Remote" : empty ? "+ Book" : `Desk ${w.you}`}
              </p>
              <div style={{ display: "flex" }}>
                {ppl.slice(0, 4).map((pi, k) => (
                  <span key={pi} style={{ marginLeft: k ? -7 : 0, display: "inline-flex" }}><Avatar p={PEOPLE[pi]} size={21} ring /></span>
                ))}
                {ppl.length > 4 && <span style={{ ...fB, fontSize: 10.5, fontWeight: 700, color: active && booked ? "#CBE8DB" : C.slate, marginLeft: 4, alignSelf: "center" }}>+{ppl.length - 4}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screen: Full floor view (the "open the whole map" page) ──────────────
function FloorScreen({ go }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [hl, setHl] = useState(null);
  const [q, setQ] = useState("");
  const day = DAYS[dayIdx];
  const inDay = Object.entries(day.occ).filter(([, pi]) =>
    PEOPLE[pi].n.toLowerCase().includes(q.toLowerCase()) || PEOPLE[pi].team.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => go("today")} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={16} color={C.ink} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ ...fD, fontSize: 24, margin: 0, color: C.ink }}>Floor 2 · Dublin HQ</p>
          <p style={{ ...fB, fontSize: 12.5, color: C.slate, margin: "2px 0 0" }}>{Object.keys(day.occ).length + (typeof day.you === "number" ? 1 : 0)} in · {DESKS.length - Object.keys(day.occ).length - (typeof day.you === "number" ? 1 : 0)} desks free</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {DAYS.map((d, i) => (
            <button key={d.d} onClick={() => setDayIdx(i)} style={{
              ...fB, fontSize: 12, fontWeight: 800, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
              background: dayIdx === i ? C.ink : "transparent", color: dayIdx === i ? "#fff" : C.slate,
              border: `1px solid ${dayIdx === i ? C.ink : C.line}`,
            }}>{d.d} {d.n}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 250px", gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 12, boxShadow: C.shadow }}>
          <LiveMap dayIdx={dayIdx} highlightPerson={hl} big onDeskClick={() => go("book")} />
          <div style={{ display: "flex", gap: 14, padding: "8px 8px 2px" }}>
            {[[C.mint, "Free"], ["#fff", "Booked"], [C.pine, "You"]].map(([col, lab]) => (
              <span key={lab} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3.5, background: col, border: `1px solid ${C.line}`, display: "inline-block" }} />
                <span style={{ ...fB, fontSize: 11.5, fontWeight: 700, color: C.slate }}>{lab}</span>
              </span>
            ))}
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: C.amber, display: "inline-block" }} />
              <span style={{ ...fB, fontSize: 11.5, fontWeight: 700, color: C.slate }}>Your usual desk</span>
            </span>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 16, boxShadow: C.shadow, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} color={C.slate} style={{ position: "absolute", left: 11, top: 10 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a person or team"
              style={{ ...fB, width: "100%", boxSizing: "border-box", fontSize: 12.5, padding: "8px 10px 8px 32px", borderRadius: 10, border: `1px solid ${C.line}`, outline: "none", background: C.page, color: C.ink }} />
          </div>
          <p style={{ ...fB, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: C.slate, margin: "0 0 10px" }}>EVERYONE IN · {day.d.toUpperCase()}</p>
          <div style={{ overflowY: "auto", flex: 1, maxHeight: 300 }}>
            {inDay.map(([deskId, pi]) => (
              <div key={pi} onMouseEnter={() => setHl(pi)} onMouseLeave={() => setHl(null)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 6px", borderRadius: 10, cursor: "pointer", background: hl === pi ? C.page : "transparent" }}>
                <Avatar p={PEOPLE[pi]} size={28} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ ...fB, fontSize: 12.5, fontWeight: 700, color: C.ink, margin: 0 }}>{PEOPLE[pi].n}</p>
                  <p style={{ ...fB, fontSize: 11, color: C.slate, margin: 0 }}>{PEOPLE[pi].team} · Desk {deskId}</p>
                </div>
              </div>
            ))}
            {inDay.length === 0 && <p style={{ ...fB, fontSize: 12.5, color: C.slate }}>No one matches.</p>}
          </div>
          <Btn primary style={{ width: "100%", marginTop: 12, padding: "9px 0", fontSize: 12.5 }} onClick={() => go("book")}>
            Book a desk this day
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Book screen ───────────────────────────────────────────────────────────
function BookScreen({ go }) {
  const [sel, setSel] = useState(14);
  const [dayIdx, setDayIdx] = useState(0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => go("today")} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ArrowLeft size={16} color={C.ink} />
          </button>
          <div>
            <p style={{ ...fD, fontSize: 24, margin: 0, color: C.ink }}>Book a desk</p>
            <p style={{ ...fB, fontSize: 12.5, color: C.slate, margin: "2px 0 0" }}>Dublin HQ · Floor 2</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {DAYS.slice(0, 3).map((d, i) => (
            <button key={d.d} onClick={() => setDayIdx(i)} style={{
              ...fB, fontSize: 13, fontWeight: 600, padding: "7px 15px", borderRadius: 999, cursor: "pointer",
              background: dayIdx === i ? C.ink : "transparent", color: dayIdx === i ? "#fff" : C.slate,
              border: `1px solid ${dayIdx === i ? C.ink : C.line}`,
            }}>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${d.d} ${d.n}`}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 232px", gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 10, boxShadow: C.shadow }}>
          <LiveMap dayIdx={dayIdx} onDeskClick={id => setSel(id)} />
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 13, boxShadow: C.shadow }}>
          <div>
            <p style={{ ...fB, fontSize: 11.5, fontWeight: 800, letterSpacing: ".07em", color: C.slate, margin: 0 }}>SELECTED</p>
            <p style={{ ...fD, fontSize: 24, margin: "3px 0 0", color: C.ink }}>Desk {sel}</p>
            <p style={{ ...fB, fontSize: 12.5, color: C.slate, margin: "3px 0 0" }}>{sel === 14 ? "Your usual spot · " : ""}window side · dual monitor</p>
          </div>
          <div style={{ ...fB, fontSize: 13, color: C.slate, display: "flex", alignItems: "center", gap: 9 }}>
            <CalendarDays size={16} /> {dayIdx === 0 ? "Today" : dayIdx === 1 ? "Tomorrow" : "Wed 12"}, all day
          </div>
          <div style={{ flex: 1 }} />
          <Btn primary style={{ width: "100%" }}>Book Desk {sel}</Btn>
          <Btn style={{ width: "100%" }}>Book Mon–Fri on this desk</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: "today", label: "Today", icon: Sparkles },
  { id: "book", label: "Book a desk", icon: Armchair },
  { id: "rooms", label: "Book a room", icon: DoorOpen },
  { id: "bookings", label: "My bookings", icon: CalendarDays },
  { id: "people", label: "People", icon: Users },
];

export default function App() {
  const [screen, setScreen] = useState("today");
  return (
    <div style={{ ...fB, background: C.page, minHeight: "100vh", color: C.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@500;600;700;800&display=swap');
        button:focus-visible, input:focus-visible { outline: 2px solid ${C.pine}; outline-offset: 2px; }
        ::-webkit-scrollbar { height: 6px; width: 6px; } ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 99px; }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", maxWidth: 1080, margin: "0 auto", minHeight: "100vh" }}>
        <div style={{ padding: "26px 14px", borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 10px", marginBottom: 28 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: C.pine, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MapIcon size={16} /></span>
            <span style={{ ...fD, fontSize: 16.5, fontWeight: 600 }}>WorkspaceCanvas</span>
          </div>
          {NAV.map(n => {
            const active = screen === n.id || (n.id === "book" && screen === "floor");
            const clickable = n.id === "today" || n.id === "book";
            return (
              <button key={n.id} onClick={() => clickable && setScreen(n.id)} style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2,
                borderRadius: 10, border: "none", cursor: clickable ? "pointer" : "default", textAlign: "left", width: "100%",
                background: active ? C.card : "transparent", ...fB, fontSize: 13.5,
                fontWeight: active ? 800 : 600, color: active ? C.ink : C.slate,
                boxShadow: active ? `inset 0 0 0 1px ${C.line}` : "none", opacity: clickable ? 1 : 0.55,
              }}>
                <n.icon size={17} color={active ? C.pine : C.slate} />{n.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 10px" }}>
            <Avatar p={{ i: "MT", n: "Mansoor", c: C.ink }} size={28} />
            <span style={{ ...fB, fontSize: 12.5, fontWeight: 700, color: C.slate }}>Mansoor</span>
          </div>
        </div>
        <div style={{ padding: "26px 34px 60px" }}>
          {screen === "today" && <TodayScreen go={setScreen} />}
          {screen === "floor" && <FloorScreen go={setScreen} />}
          {screen === "book" && <BookScreen go={setScreen} />}
        </div>
      </div>
    </div>
  );
}
