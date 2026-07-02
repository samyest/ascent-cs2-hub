import { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "./storage";

/* ================== CONFIG ================== */
const STORAGE_KEY = "cs2hub:data:v1";
const MAP_POOL = ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Dust2", "Train"];
const ROLES = ["IGL", "AWPer", "Entry", "Support", "Lurker", "Rifler"];
const KANBAN_COLS = [
  { id: "todo", label: "Para treinar" },
  { id: "doing", label: "Em treino" },
  { id: "done", label: "Dominado" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_DATA = {
  players: [],
  tasks: [],
  positions: {}, // { [map]: { [playerId]: { t: "", ct: "" } } }
  tactics: [],
  videos: [], // { id, title, url, map, addedBy, addedAt }
  events: [], // { id, title, type, date, time, notes, createdBy, rsvp: { [who]: "yes"|"no"|"maybe" } }
  matches: [], // { id, date, opponent, map, scoreUs, scoreThem, type, notes, addedBy }
  antistrats: [], // { id, team, notes, updatedBy, updatedAt }
  veto: {}, // { [map]: { pref: "Pick"|"Neutro"|"Ban", note } } + { _order: texto }
};

/* ================== STORAGE ================== */
// Dados do time são COMPARTILHADOS (Supabase): todos veem o mesmo conteúdo.
async function loadData() {
  try {
    const res = await storage.get(STORAGE_KEY, true);
    if (res && res.value) return { ...DEFAULT_DATA, ...JSON.parse(res.value) };
  } catch (e) {
    console.error("Falha ao carregar", e);
  }
  return DEFAULT_DATA;
}
async function saveData(data) {
  try {
    await storage.set(STORAGE_KEY, JSON.stringify(data), true);
    return true;
  } catch (e) {
    console.error("Falha ao salvar", e);
    return false;
  }
}

/* ================== LOGIN ================== */
const TEAM_PASSWORD = "guts";
const ADMIN_NICK = "est";
const ADMIN_PASSWORD = "3301";
const SESSION_KEY = "cs2hub:session:v1"; // pessoal: cada dispositivo lembra o próprio login

async function loadSession() {
  try {
    const res = await storage.get(SESSION_KEY, false);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  return null;
}
async function saveSession(session) {
  try {
    if (session) await storage.set(SESSION_KEY, JSON.stringify(session), false);
    else await storage.delete(SESSION_KEY, false);
  } catch (e) {}
}

/* ================== APP ================== */
export default function App() {
  const [data, setData] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = carregando, null = deslogado
  const [tab, setTab] = useState("agenda");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    Promise.all([loadData(), loadSession()]).then(([d, s]) => {
      setData(d);
      setSession(s);
    });
  }, []);

  // autosave com debounce
  useEffect(() => {
    if (!data) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveData(data);
      setSaveState(ok ? "saved" : "error");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  const update = useCallback((fn) => setData((d) => fn(structuredClone(d))), []);

  if (!data || session === undefined) {
    return (
      <div className="hub-root hub-loading">
        <Style />
        <div className="loading-box">
          <span className="dot" /> carregando dados do time…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Login
        players={data.players}
        onLogin={(s) => {
          setSession(s);
          saveSession(s);
        }}
      />
    );
  }

  const logout = () => {
    setSession(null);
    saveSession(null);
  };

  const tabs = [
    { id: "agenda", label: "Agenda" },
    { id: "kanban", label: "Kanban" },
    { id: "positions", label: "Posições" },
    { id: "tactics", label: "Táticas" },
    { id: "veto", label: "Veto" },
    { id: "antistrats", label: "Anti-strats" },
    { id: "matches", label: "Partidas" },
    { id: "videos", label: "Vídeos" },
    { id: "team", label: "Time" },
  ];

  return (
    <div className="hub-root">
      <Style />
      <header className="hub-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">
            <path d="M50 4 L96 92 L50 66 L4 92 Z" fill="var(--accent)" />
            <path d="M50 34 L57 52 L76 52 L61 63 L67 82 L50 70 L33 82 L39 63 L24 52 L43 52 Z" fill="var(--bg)" />
          </svg>
          <div>
            <h1>ASCENT</h1>
            <span className="brand-sub">CS2 · sala tática</span>
          </div>
        </div>
        <div className="header-right">
          <div className="save-pill" data-state={saveState}>
            {saveState === "saving" && "salvando…"}
            {saveState === "saved" && "salvo ✓"}
            {saveState === "error" && "erro ao salvar"}
            {saveState === "idle" && "auto-save ativo"}
          </div>
          <div className="user-pill">
            <span className="user-nick">{session.nick}</span>
            {session.admin && <span className="admin-badge">ADMIN</span>}
            <button className="btn ghost" onClick={logout}>
              sair
            </button>
          </div>
        </div>
      </header>

      <nav className="hub-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {data.players.length === 0 && tab !== "team" ? (
        <EmptyTeam goTeam={() => setTab("team")} />
      ) : (
        <>
          {tab === "agenda" && <Agenda data={data} update={update} session={session} />}
          {tab === "kanban" && <Kanban data={data} update={update} session={session} />}
          {tab === "positions" && <Positions data={data} update={update} />}
          {tab === "tactics" && <Tactics data={data} update={update} />}
          {tab === "veto" && <Veto data={data} update={update} />}
          {tab === "antistrats" && <AntiStrats data={data} update={update} session={session} />}
          {tab === "matches" && <Matches data={data} update={update} session={session} />}
          {tab === "videos" && <Videos data={data} update={update} session={session} />}
          {tab === "team" && <Team data={data} update={update} session={session} />}
        </>
      )}
    </div>
  );
}

function EmptyTeam({ goTeam }) {
  return (
    <div className="empty-state">
      <p>Nenhum player cadastrado ainda.</p>
      <button className="btn primary" onClick={goTeam}>
        Cadastrar o time
      </button>
    </div>
  );
}

/* ================== LOGIN ================== */
function Login({ players, onLogin }) {
  const [nick, setNick] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const firstAccess = players.length === 0;

  const submit = () => {
    const n = nick.trim();
    if (!n) return setError("Digite seu nick.");

    // login admin
    if (n.toLowerCase() === ADMIN_NICK) {
      if (pass !== ADMIN_PASSWORD) return setError("Senha incorreta.");
      return onLogin({ nick: ADMIN_NICK, playerId: null, admin: true });
    }

    // login de player
    if (pass !== TEAM_PASSWORD) return setError("Senha incorreta.");
    const player = players.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (!player)
      return setError(
        firstAccess
          ? "O elenco ainda não foi cadastrado. Entre com o login admin para cadastrar."
          : "Nick não encontrado no elenco. Fale com o admin do time."
      );
    onLogin({ nick: player.name, playerId: player.id, admin: false });
  };

  return (
    <div className="hub-root login-screen">
      <Style />
      <div className="login-box">
        <svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
          <path d="M50 4 L96 92 L50 66 L4 92 Z" fill="var(--accent)" />
          <path d="M50 34 L57 52 L76 52 L61 63 L67 82 L50 70 L33 82 L39 63 L24 52 L43 52 Z" fill="var(--bg)" />
        </svg>
        <h1>ASCENT</h1>
        <span className="brand-sub">CS2 · sala tática</span>

        <div className="login-form">
          <input
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Nick"
            autoFocus
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Senha do time"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn primary" onClick={submit}>
            Entrar
          </button>
          {firstAccess && (
            <p className="hint">
              Primeiro acesso: entre com o login admin para cadastrar o elenco. Depois, cada
              player entra com o próprio nick e a senha do time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================== TIME ================== */
function Team({ data, update, session }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const isAdmin = !!session?.admin;

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update((d) => {
      d.players.push({ id: uid(), name: n, role });
      return d;
    });
    setName("");
  };

  const remove = (id) => {
    update((d) => {
      d.players = d.players.filter((p) => p.id !== id);
      d.tasks = d.tasks.filter((t) => t.playerId !== id);
      Object.values(d.positions).forEach((m) => delete m[id]);
      return d;
    });
  };

  const rename = (id, field, value) =>
    update((d) => {
      const p = d.players.find((p) => p.id === id);
      if (p) p[field] = value;
      return d;
    });

  return (
    <section className="panel">
      <h2 className="panel-title">Elenco</h2>
      {!isAdmin && <p className="hint" style={{ marginTop: 0 }}>Somente o admin pode editar o elenco.</p>}
      {isAdmin && (
        <div className="add-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nick do player"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="btn primary" onClick={add}>
            Adicionar
          </button>
        </div>
      )}

      <div className="roster">
        {data.players.map((p, i) => (
          <div className="roster-card" key={p.id}>
            <span className="roster-num">{String(i + 1).padStart(2, "0")}</span>
            {isAdmin ? (
              <>
                <input
                  className="roster-name"
                  value={p.name}
                  onChange={(e) => rename(p.id, "name", e.target.value)}
                />
                <select value={p.role} onChange={(e) => rename(p.id, "role", e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <button className="btn ghost danger" onClick={() => remove(p.id)}>
                  remover
                </button>
              </>
            ) : (
              <>
                <span className="roster-name">{p.name}</span>
                <span className="tag player">{p.role}</span>
              </>
            )}
          </div>
        ))}
        {data.players.length === 0 && (
          <p className="hint">Adicione os 5 do lineup (e reservas, se tiver).</p>
        )}
      </div>
    </section>
  );
}

/* ================== KANBAN ================== */
function Kanban({ data, update, session }) {
  const [filter, setFilter] = useState(
    session?.playerId && data.players.some((p) => p.id === session.playerId)
      ? session.playerId
      : "all"
  );
  const [title, setTitle] = useState("");
  const [playerId, setPlayerId] = useState(data.players[0]?.id || "");
  const [map, setMap] = useState("");
  const dragId = useRef(null);
  const [overCol, setOverCol] = useState(null);

  const add = () => {
    const t = title.trim();
    if (!t || !playerId) return;
    update((d) => {
      d.tasks.push({ id: uid(), title: t, playerId, map, status: "todo" });
      return d;
    });
    setTitle("");
  };

  const move = (id, status) =>
    update((d) => {
      const t = d.tasks.find((t) => t.id === id);
      if (t) t.status = status;
      return d;
    });

  const remove = (id) =>
    update((d) => {
      d.tasks = d.tasks.filter((t) => t.id !== id);
      return d;
    });

  const playerOf = (id) => data.players.find((p) => p.id === id);
  const visible = data.tasks.filter((t) => filter === "all" || t.playerId === filter);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Treinos & pendências</h2>
        <div className="filter-chips">
          <button
            className={"chip" + (filter === "all" ? " on" : "")}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          {data.players.map((p) => (
            <button
              key={p.id}
              className={"chip" + (filter === p.id ? " on" : "")}
              onClick={() => setFilter(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="add-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Ex.: aprender smoke janela da Mirage"
        />
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          {data.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={map} onChange={(e) => setMap(e.target.value)}>
          <option value="">— mapa —</option>
          {MAP_POOL.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button className="btn primary" onClick={add}>
          Criar card
        </button>
      </div>

      <div className="board">
        {KANBAN_COLS.map((col) => {
          const cards = visible.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className={"col" + (overCol === col.id ? " over" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => {
                if (dragId.current) move(dragId.current, col.id);
                dragId.current = null;
                setOverCol(null);
              }}
            >
              <div className="col-head">
                <span>{col.label}</span>
                <span className="count">{cards.length}</span>
              </div>
              {cards.map((t) => {
                const p = playerOf(t.playerId);
                return (
                  <div
                    key={t.id}
                    className="card"
                    draggable
                    onDragStart={() => (dragId.current = t.id)}
                  >
                    <div className="card-title">{t.title}</div>
                    <div className="card-meta">
                      <span className="tag player">{p ? p.name : "?"}</span>
                      {t.map && <span className="tag map">{t.map}</span>}
                    </div>
                    <div className="card-actions">
                      {col.id !== "todo" && (
                        <button onClick={() => move(t.id, col.id === "done" ? "doing" : "todo")}>
                          ←
                        </button>
                      )}
                      {col.id !== "done" && (
                        <button onClick={() => move(t.id, col.id === "todo" ? "doing" : "done")}>
                          →
                        </button>
                      )}
                      <button className="del" onClick={() => remove(t.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              {cards.length === 0 && <div className="col-empty">arraste cards aqui</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================== POSIÇÕES ================== */
function Positions({ data, update }) {
  const [map, setMap] = useState(MAP_POOL[0]);

  const setPos = (playerId, side, value) =>
    update((d) => {
      if (!d.positions[map]) d.positions[map] = {};
      if (!d.positions[map][playerId]) d.positions[map][playerId] = { t: "", ct: "" };
      d.positions[map][playerId][side] = value;
      return d;
    });

  const get = (playerId, side) => data.positions?.[map]?.[playerId]?.[side] || "";

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Posições por mapa</h2>
        <div className="filter-chips">
          {MAP_POOL.map((m) => (
            <button
              key={m}
              className={"chip" + (map === m ? " on" : "")}
              onClick={() => setMap(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="scoreboard">
        <div className="sb-row sb-head">
          <div className="sb-player">Player</div>
          <div className="sb-side t">LADO TR</div>
          <div className="sb-side ct">LADO CT</div>
        </div>
        {data.players.map((p) => (
          <div className="sb-row" key={p.id}>
            <div className="sb-player">
              <strong>{p.name}</strong>
              <span className="role">{p.role}</span>
            </div>
            <div className="sb-cell t">
              <input
                value={get(p.id, "t")}
                onChange={(e) => setPos(p.id, "t", e.target.value)}
                placeholder="Ex.: entry meio / rampa"
              />
            </div>
            <div className="sb-cell ct">
              <input
                value={get(p.id, "ct")}
                onChange={(e) => setPos(p.id, "ct", e.target.value)}
                placeholder="Ex.: âncora B / varanda"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="hint">
        As posições são salvas por mapa — troque de mapa nos chips acima para preencher cada um.
      </p>
    </section>
  );
}

/* ================== TÁTICAS ================== */
function Tactics({ data, update }) {
  const [name, setName] = useState("");
  const [map, setMap] = useState(MAP_POOL[0]);
  const [side, setSide] = useState("TR");
  const [filterMap, setFilterMap] = useState("all");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update((d) => {
      d.tactics.push({ id: uid(), name: n, map, side, steps: "" });
      return d;
    });
    setName("");
  };

  const edit = (id, field, value) =>
    update((d) => {
      const t = d.tactics.find((t) => t.id === id);
      if (t) t[field] = value;
      return d;
    });

  const remove = (id) =>
    update((d) => {
      d.tactics = d.tactics.filter((t) => t.id !== id);
      return d;
    });

  const visible = data.tactics.filter((t) => filterMap === "all" || t.map === filterMap);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Playbook</h2>
        <div className="filter-chips">
          <button
            className={"chip" + (filterMap === "all" ? " on" : "")}
            onClick={() => setFilterMap("all")}
          >
            Todos
          </button>
          {MAP_POOL.map((m) => (
            <button
              key={m}
              className={"chip" + (filterMap === m ? " on" : "")}
              onClick={() => setFilterMap(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="add-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder='Nome da tática — ex.: "Execute A padrão"'
        />
        <select value={map} onChange={(e) => setMap(e.target.value)}>
          {MAP_POOL.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          <option>TR</option>
          <option>CT</option>
        </select>
        <button className="btn primary" onClick={add}>
          Criar tática
        </button>
      </div>

      <div className="tactic-grid">
        {visible.map((t) => (
          <div className="tactic" key={t.id} data-side={t.side}>
            <div className="tactic-head">
              <input
                className="tactic-name"
                value={t.name}
                onChange={(e) => edit(t.id, "name", e.target.value)}
              />
              <span className={"side-badge " + (t.side === "TR" ? "t" : "ct")}>{t.side}</span>
            </div>
            <div className="tactic-meta">
              <span className="tag map">{t.map}</span>
              <button className="btn ghost danger" onClick={() => remove(t.id)}>
                excluir
              </button>
            </div>
            <textarea
              value={t.steps}
              onChange={(e) => edit(t.id, "steps", e.target.value)}
              placeholder={
                "Passo a passo, utilitária e função de cada player…\n1. smoke janela + smoke conector\n2. flash por cima do apto\n3. entry seca A, trade atrás"
              }
              rows={6}
            />
          </div>
        ))}
        {visible.length === 0 && (
          <p className="hint">Nenhuma tática ainda. Crie a primeira acima — vale anotar até o pistol round.</p>
        )}
      </div>
    </section>
  );
}

/* ================== VÍDEOS ================== */
function youtubeThumb(url) {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1).split("/")[0];
    else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
      else id = u.searchParams.get("v") || "";
    }
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
  } catch (e) {
    return null;
  }
}

function Videos({ data, update, session }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [map, setMap] = useState(MAP_POOL[0]);
  const [filterMap, setFilterMap] = useState("all");
  const [error, setError] = useState("");

  const videos = data.videos || [];

  const add = () => {
    const t = title.trim();
    let u = url.trim();
    if (!t) return setError("Dê um título para o vídeo.");
    if (!u) return setError("Cole a URL do vídeo.");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      new URL(u);
    } catch (e) {
      return setError("URL inválida.");
    }
    update((d) => {
      if (!d.videos) d.videos = [];
      d.videos.unshift({
        id: uid(),
        title: t,
        url: u,
        map,
        addedBy: session.nick,
        addedAt: new Date().toISOString().slice(0, 10),
      });
      return d;
    });
    setTitle("");
    setUrl("");
    setError("");
  };

  const remove = (id) =>
    update((d) => {
      d.videos = (d.videos || []).filter((v) => v.id !== id);
      return d;
    });

  const canRemove = (v) => session.admin || v.addedBy === session.nick;
  const visible = videos.filter((v) => filterMap === "all" || v.map === filterMap);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Vídeos de estudo</h2>
        <div className="filter-chips">
          <button
            className={"chip" + (filterMap === "all" ? " on" : "")}
            onClick={() => setFilterMap("all")}
          >
            Todos
          </button>
          {MAP_POOL.map((m) => (
            <button
              key={m}
              className={"chip" + (filterMap === m ? " on" : "")}
              onClick={() => setFilterMap(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="add-row">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          placeholder='Título — ex.: "Setup CT bomba B"'
        />
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="URL do vídeo (YouTube, Twitch…)"
        />
        <select value={map} onChange={(e) => setMap(e.target.value)}>
          {MAP_POOL.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button className="btn primary" onClick={add}>
          Salvar vídeo
        </button>
      </div>
      {error && <p className="login-error">{error}</p>}

      <div className="video-grid">
        {visible.map((v) => {
          const thumb = youtubeThumb(v.url);
          return (
            <div className="video-card" key={v.id}>
              <a className="video-thumb" href={v.url} target="_blank" rel="noopener noreferrer">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement.classList.add("no-thumb");
                    }}
                  />
                ) : null}
                <span className="play">▶</span>
              </a>
              <div className="video-body">
                <a className="video-title" href={v.url} target="_blank" rel="noopener noreferrer">
                  {v.title}
                </a>
                <div className="card-meta">
                  <span className="tag map">{v.map}</span>
                  <span className="tag player">salvo por {v.addedBy}</span>
                </div>
                <div className="video-foot">
                  <span className="video-date">{v.addedAt}</span>
                  {canRemove(v) && (
                    <button className="btn ghost danger" onClick={() => remove(v.id)}>
                      excluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="hint">
            {filterMap === "all"
              ? "Nenhum vídeo salvo ainda. Cole a URL de uma demo, VOD ou tutorial de utilitária acima."
              : `Nenhum vídeo de ${filterMap} ainda.`}
          </p>
        )}
      </div>
    </section>
  );
}

/* ================== AGENDA ================== */
const EVENT_TYPES = ["Treino", "Scrim", "Campeonato", "Outro"];
const RSVP = [
  { id: "yes", label: "Vou" },
  { id: "maybe", label: "Talvez" },
  { id: "no", label: "Não vou" },
];

function Agenda({ data, update, session }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(EVENT_TYPES[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showPast, setShowPast] = useState(false);

  const me = session.playerId || session.nick;
  const events = data.events || [];
  const today = new Date().toISOString().slice(0, 10);

  const add = () => {
    if (!title.trim() || !date) return;
    update((d) => {
      if (!d.events) d.events = [];
      d.events.push({
        id: uid(),
        title: title.trim(),
        type,
        date,
        time,
        createdBy: session.nick,
        rsvp: {},
      });
      return d;
    });
    setTitle("");
    setDate("");
    setTime("");
  };

  const setRsvp = (eventId, value) =>
    update((d) => {
      const ev = d.events.find((e) => e.id === eventId);
      if (ev) {
        if (!ev.rsvp) ev.rsvp = {};
        ev.rsvp[me] = ev.rsvp[me] === value ? undefined : value;
      }
      return d;
    });

  const remove = (id) =>
    update((d) => {
      d.events = d.events.filter((e) => e.id !== id);
      return d;
    });

  const canRemove = (ev) => session.admin || ev.createdBy === session.nick;
  const nameOf = (who) => data.players.find((p) => p.id === who)?.name || who;
  const fmtDate = (iso) => {
    const [y, m, dd] = iso.split("-");
    return `${dd}/${m}/${y}`;
  };

  const sorted = [...events].sort((a, b) =>
    (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))
  );
  const upcoming = sorted.filter((e) => e.date >= today);
  const past = sorted.filter((e) => e.date < today).reverse();
  const shown = showPast ? past : upcoming;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Agenda</h2>
        <div className="filter-chips">
          <button className={"chip" + (!showPast ? " on" : "")} onClick={() => setShowPast(false)}>
            Próximos ({upcoming.length})
          </button>
          <button className={"chip" + (showPast ? " on" : "")} onClick={() => setShowPast(true)}>
            Passados ({past.length})
          </button>
        </div>
      </div>

      <div className="add-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder='Ex.: "Pracc + review de demo"'
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {EVENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <button className="btn primary" onClick={add}>
          Marcar
        </button>
      </div>

      <div className="event-list">
        {shown.map((ev) => {
          const rsvp = ev.rsvp || {};
          const yes = Object.entries(rsvp).filter(([, v]) => v === "yes");
          const mine = rsvp[me];
          return (
            <div className="event" key={ev.id}>
              <div className="event-when">
                <span className="event-date">{fmtDate(ev.date)}</span>
                {ev.time && <span className="event-time">{ev.time}</span>}
              </div>
              <div className="event-main">
                <div className="event-title-row">
                  <strong>{ev.title}</strong>
                  <span className="tag map">{ev.type}</span>
                </div>
                <div className="event-rsvps">
                  {data.players.map((p) => {
                    const v = rsvp[p.id];
                    return (
                      <span key={p.id} className={"rsvp-chip " + (v || "none")}>
                        {p.name}
                        {v === "yes" ? " ✓" : v === "no" ? " ✕" : v === "maybe" ? " ?" : ""}
                      </span>
                    );
                  })}
                </div>
                <span className="hint" style={{ marginTop: 4 }}>
                  {yes.length}/{data.players.length} confirmados · marcado por {ev.createdBy}
                </span>
              </div>
              <div className="event-actions">
                {!showPast &&
                  RSVP.map((r) => (
                    <button
                      key={r.id}
                      className={"chip" + (mine === r.id ? " on" : "")}
                      onClick={() => setRsvp(ev.id, r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                {canRemove(ev) && (
                  <button className="btn ghost danger" onClick={() => remove(ev.id)}>
                    excluir
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="hint">
            {showPast ? "Nenhum evento passado registrado." : "Nada marcado. Agende o próximo treino acima."}
          </p>
        )}
      </div>
    </section>
  );
}

/* ================== PARTIDAS ================== */
function Matches({ data, update, session }) {
  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [map, setMap] = useState(MAP_POOL[0]);
  const [scoreUs, setScoreUs] = useState("");
  const [scoreThem, setScoreThem] = useState("");
  const [type, setType] = useState("Scrim");
  const [filterMap, setFilterMap] = useState("all");

  const matches = data.matches || [];

  const add = () => {
    if (!opponent.trim() || scoreUs === "" || scoreThem === "") return;
    update((d) => {
      if (!d.matches) d.matches = [];
      d.matches.unshift({
        id: uid(),
        date: date || new Date().toISOString().slice(0, 10),
        opponent: opponent.trim(),
        map,
        scoreUs: Number(scoreUs),
        scoreThem: Number(scoreThem),
        type,
        notes: "",
        addedBy: session.nick,
      });
      return d;
    });
    setOpponent("");
    setScoreUs("");
    setScoreThem("");
  };

  const edit = (id, field, value) =>
    update((d) => {
      const m = d.matches.find((m) => m.id === id);
      if (m) m[field] = value;
      return d;
    });

  const remove = (id) =>
    update((d) => {
      d.matches = d.matches.filter((m) => m.id !== id);
      return d;
    });

  const canRemove = (m) => session.admin || m.addedBy === session.nick;
  const result = (m) => (m.scoreUs > m.scoreThem ? "V" : m.scoreUs < m.scoreThem ? "D" : "E");

  // retrospecto por mapa
  const record = {};
  MAP_POOL.forEach((mp) => (record[mp] = { v: 0, d: 0, e: 0 }));
  matches.forEach((m) => {
    if (!record[m.map]) record[m.map] = { v: 0, d: 0, e: 0 };
    const r = result(m);
    if (r === "V") record[m.map].v++;
    else if (r === "D") record[m.map].d++;
    else record[m.map].e++;
  });

  const visible = matches.filter((m) => filterMap === "all" || m.map === filterMap);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Histórico de partidas</h2>
        <div className="filter-chips">
          <button
            className={"chip" + (filterMap === "all" ? " on" : "")}
            onClick={() => setFilterMap("all")}
          >
            Todos
          </button>
          {MAP_POOL.map((m) => (
            <button
              key={m}
              className={"chip" + (filterMap === m ? " on" : "")}
              onClick={() => setFilterMap(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="record-strip">
        {MAP_POOL.filter((mp) => record[mp].v + record[mp].d + record[mp].e > 0).map((mp) => (
          <div className="record-item" key={mp}>
            <span className="record-map">{mp}</span>
            <span className="record-score">
              <b className="win">{record[mp].v}V</b> · <b className="loss">{record[mp].d}D</b>
              {record[mp].e > 0 && <> · {record[mp].e}E</>}
            </span>
          </div>
        ))}
      </div>

      <div className="add-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="Adversário"
        />
        <select value={map} onChange={(e) => setMap(e.target.value)}>
          {MAP_POOL.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={scoreUs}
          onChange={(e) => setScoreUs(e.target.value)}
          placeholder="Nós"
          style={{ width: 70 }}
        />
        <input
          type="number"
          min="0"
          value={scoreThem}
          onChange={(e) => setScoreThem(e.target.value)}
          placeholder="Eles"
          style={{ width: 70 }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>Scrim</option>
          <option>Official</option>
        </select>
        <button className="btn primary" onClick={add}>
          Registrar
        </button>
      </div>

      <div className="match-list">
        {visible.map((m) => (
          <div className="match" key={m.id}>
            <span className={"result-badge " + result(m).toLowerCase()}>{result(m)}</span>
            <div className="match-main">
              <div className="match-line">
                <strong>
                  {m.scoreUs} × {m.scoreThem}
                </strong>
                <span>vs {m.opponent}</span>
                <span className="tag map">{m.map}</span>
                <span className="tag player">{m.type}</span>
                <span className="video-date">{m.date}</span>
              </div>
              <input
                className="match-notes"
                value={m.notes}
                onChange={(e) => edit(m.id, "notes", e.target.value)}
                placeholder="O que funcionou / o que ajustar…"
              />
            </div>
            {canRemove(m) && (
              <button className="btn ghost danger" onClick={() => remove(m.id)}>
                ✕
              </button>
            )}
          </div>
        ))}
        {visible.length === 0 && <p className="hint">Nenhuma partida registrada ainda.</p>}
      </div>
    </section>
  );
}

/* ================== ANTI-STRATS ================== */
function AntiStrats({ data, update, session }) {
  const [team, setTeam] = useState("");
  const list = data.antistrats || [];

  const add = () => {
    const t = team.trim();
    if (!t) return;
    update((d) => {
      if (!d.antistrats) d.antistrats = [];
      d.antistrats.unshift({
        id: uid(),
        team: t,
        notes: "",
        updatedBy: session.nick,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
      return d;
    });
    setTeam("");
  };

  const edit = (id, field, value) =>
    update((d) => {
      const a = d.antistrats.find((a) => a.id === id);
      if (a) {
        a[field] = value;
        a.updatedBy = session.nick;
        a.updatedAt = new Date().toISOString().slice(0, 10);
      }
      return d;
    });

  const remove = (id) =>
    update((d) => {
      d.antistrats = d.antistrats.filter((a) => a.id !== id);
      return d;
    });

  return (
    <section className="panel">
      <h2 className="panel-title">Anti-strats</h2>
      <div className="add-row">
        <input
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nome do time adversário"
        />
        <button className="btn primary" onClick={add}>
          Criar ficha
        </button>
      </div>

      <div className="tactic-grid">
        {list.map((a) => (
          <div className="tactic" key={a.id} data-side="CT">
            <div className="tactic-head">
              <input
                className="tactic-name"
                value={a.team}
                onChange={(e) => edit(a.id, "team", e.target.value)}
              />
              <button className="btn ghost danger" onClick={() => remove(a.id)}>
                excluir
              </button>
            </div>
            <textarea
              value={a.notes}
              onChange={(e) => edit(a.id, "notes", e.target.value)}
              placeholder={
                "Tendências do adversário…\n· pistol: rush B os 5\n· AWPer fica meio na CT\n· execute A sempre com 4 smokes"
              }
              rows={7}
            />
            <span className="video-date">
              atualizado por {a.updatedBy} em {a.updatedAt}
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <p className="hint">
            Nenhuma ficha ainda. Crie uma por adversário recorrente — vale anotar tudo que virem em
            demo ou dentro do servidor.
          </p>
        )}
      </div>
    </section>
  );
}

/* ================== VETO ================== */
const VETO_PREFS = ["Pick", "Neutro", "Ban"];

function Veto({ data, update }) {
  const veto = data.veto || {};

  const set = (map, field, value) =>
    update((d) => {
      if (!d.veto) d.veto = {};
      if (!d.veto[map]) d.veto[map] = { pref: "Neutro", note: "" };
      d.veto[map][field] = value;
      return d;
    });

  const setOrder = (value) =>
    update((d) => {
      if (!d.veto) d.veto = {};
      d.veto._order = value;
      return d;
    });

  const prefOf = (m) => veto[m]?.pref || "Neutro";
  const rank = { Pick: 0, Neutro: 1, Ban: 2 };
  const sortedMaps = [...MAP_POOL].sort((a, b) => rank[prefOf(a)] - rank[prefOf(b)]);

  return (
    <section className="panel">
      <h2 className="panel-title">Veto de mapas</h2>
      <div className="scoreboard" style={{ marginBottom: 16 }}>
        <div className="sb-row sb-head veto-row">
          <div className="sb-player">Mapa</div>
          <div style={{ padding: "10px 12px" }}>Preferência</div>
          <div style={{ padding: "10px 12px" }}>Observação</div>
        </div>
        {sortedMaps.map((m) => (
          <div className="sb-row veto-row" key={m}>
            <div className="sb-player">
              <strong>{m}</strong>
            </div>
            <div className="sb-cell veto-pref" data-pref={prefOf(m)}>
              <div className="filter-chips">
                {VETO_PREFS.map((p) => (
                  <button
                    key={p}
                    className={"chip" + (prefOf(m) === p ? " on" : "")}
                    onClick={() => set(m, "pref", p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="sb-cell">
              <input
                value={veto[m]?.note || ""}
                onChange={(e) => set(m, "note", e.target.value)}
                placeholder="Ex.: pick se tiver AWP no lado CT"
              />
            </div>
          </div>
        ))}
      </div>

      <h3 className="panel-title" style={{ fontSize: 16 }}>Ordem de veto (BO1 / BO3)</h3>
      <textarea
        value={veto._order || ""}
        onChange={(e) => setOrder(e.target.value)}
        placeholder={
          "Anote a lógica do veto…\nBO1: ban Nuke → ban Train → deixar Mirage/Inferno vivos\nBO3: pick Inferno primeiro, ban Nuke sempre"
        }
        rows={5}
      />
    </section>
  );
}

/* ================== ESTILO ================== */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap');

      :root {
        --bg: #080B0A;
        --panel: #101514;
        --panel-2: #161C1A;
        --line: #202B27;
        --text: #E2EAE6;
        --muted: #8CA096;
        --accent: #57C68E;  /* verde Ascent */
        --t: #E3A852;       /* amarelo terrorista */
        --t-dim: #3A2F1D;
        --ct: #6E9CD0;      /* azul CT */
        --ct-dim: #1C2A3C;
        --danger: #D06E6E;
        --radius: 6px;
        --display: 'Barlow Condensed', 'Arial Narrow', sans-serif;
        --body: 'Inter', system-ui, sans-serif;
      }
      .hub-root {
        background: var(--bg);
        color: var(--text);
        font-family: var(--body);
        min-height: 100vh;
        padding: 20px clamp(12px, 3vw, 32px) 48px;
        background-image:
          linear-gradient(var(--line) 1px, transparent 1px),
          linear-gradient(90deg, var(--line) 1px, transparent 1px);
        background-size: 48px 48px;
        background-position: -1px -1px;
        background-blend-mode: normal;
      }
      .hub-root::before { content:''; }

      /* header */
      .hub-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
      .brand { display:flex; align-items:center; gap:12px; }
      .brand-mark { display:block; }
      .brand h1 { font-family: var(--display); font-size: 30px; font-weight:700; letter-spacing: 3px; margin:0; line-height:1; }
      .brand-sub { color: var(--muted); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
      .save-pill { font-size: 11px; letter-spacing:.5px; color: var(--muted); border:1px solid var(--line); border-radius: 999px; padding: 4px 12px; background: var(--panel); }
      .save-pill[data-state="saved"] { color:#8FCB9B; border-color:#2E4536; }
      .save-pill[data-state="error"] { color: var(--danger); border-color:#4A2A2A; }
      .header-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .user-pill { display:flex; align-items:center; gap:6px; border:1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 3px 6px 3px 12px; }
      .user-nick { font-size: 12px; font-weight: 600; color: var(--accent); letter-spacing:.5px; }
      .admin-badge { font-family: var(--display); font-size: 11px; letter-spacing: 1.5px; background: var(--accent); color: #06130C; border-radius: 3px; padding: 1px 7px; }

      /* login */
      .login-screen { display:grid; place-items:center; min-height: 90vh; }
      .login-box { text-align:center; background: var(--panel); border:1px solid var(--line); border-radius: 8px; padding: 36px 32px; width: min(340px, 90vw); }
      .login-box h1 { font-family: var(--display); font-size: 34px; letter-spacing: 5px; margin: 10px 0 2px; }
      .login-form { display:flex; flex-direction:column; gap:10px; margin-top: 22px; text-align:left; }
      .login-form input { width: 100%; box-sizing: border-box; }
      .login-error { color: var(--danger); font-size: 12.5px; margin: 0; }

      /* tabs */
      .hub-tabs { display:flex; gap:4px; border-bottom: 2px solid var(--line); margin-bottom: 20px; overflow-x:auto; }
      .tab {
        font-family: var(--display); font-size:17px; letter-spacing:1.5px; text-transform:uppercase;
        background: none; border: none; color: var(--muted); padding: 10px 18px 8px; cursor:pointer;
        border-bottom: 3px solid transparent; margin-bottom:-2px; white-space:nowrap;
      }
      .tab:hover { color: var(--text); }
      .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
      .tab:focus-visible, .btn:focus-visible, .chip:focus-visible { outline: 2px solid var(--ct); outline-offset: 2px; }

      /* painéis */
      .panel { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; }
      .panel-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
      .panel-title { font-family: var(--display); font-size: 21px; letter-spacing:2px; text-transform: uppercase; margin: 0 0 4px; color: var(--text); }

      /* inputs */
      input, select, textarea {
        background: var(--panel-2); border: 1px solid var(--line); color: var(--text);
        border-radius: 4px; padding: 8px 10px; font-family: var(--body); font-size: 13.5px;
      }
      input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
      textarea { width: 100%; resize: vertical; line-height: 1.5; box-sizing: border-box; }
      .add-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 18px; }
      .add-row input { flex: 1 1 220px; }

      .btn { border-radius:4px; border:1px solid var(--line); background: var(--panel-2); color: var(--text); padding: 8px 14px; cursor:pointer; font-family: var(--body); font-size: 13px; font-weight:500; }
      .btn.primary { background: var(--accent); border-color: var(--accent); color: #06130C; font-weight:600; }
      .btn.primary:hover { filter: brightness(1.08); }
      .btn.ghost { background:none; border:none; color: var(--muted); padding:4px 6px; font-size:12px; }
      .btn.ghost.danger:hover { color: var(--danger); }

      .chip { background: var(--panel-2); border:1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 5px 12px; font-size: 12px; cursor:pointer; }
      .chip:hover { color: var(--text); }
      .chip.on { border-color: var(--accent); color: var(--accent); background: rgba(87,198,142,.08); }
      .filter-chips { display:flex; gap:6px; flex-wrap:wrap; }

      .hint { color: var(--muted); font-size: 12.5px; margin-top: 12px; }
      .empty-state { text-align:center; padding: 60px 20px; color: var(--muted); }
      .empty-state .btn { margin-top: 12px; }
      .hub-loading { display:grid; place-items:center; min-height: 40vh; }
      .loading-box { color: var(--muted); font-size: 13px; }
      .loading-box .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background: var(--accent); margin-right:8px; animation: pulse 1s infinite; }
      @keyframes pulse { 50% { opacity:.3; } }
      @media (prefers-reduced-motion: reduce) { .loading-box .dot { animation:none; } }

      /* kanban */
      .board { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      @media (max-width: 760px) { .board { grid-template-columns: 1fr; } }
      .col { background: var(--panel-2); border:1px solid var(--line); border-radius: var(--radius); padding: 10px; min-height: 180px; transition: border-color .15s; }
      .col.over { border-color: var(--accent); }
      .col-head { display:flex; justify-content:space-between; align-items:center; font-family: var(--display); text-transform:uppercase; letter-spacing:1.5px; font-size:15px; color: var(--muted); padding: 2px 4px 10px; }
      .count { background: var(--panel); border:1px solid var(--line); border-radius: 999px; font-size: 11px; padding: 1px 8px; font-family: var(--body); }
      .card { background: var(--panel); border:1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 4px; padding: 10px; margin-bottom: 8px; cursor: grab; }
      .card:active { cursor: grabbing; }
      .card-title { font-size: 13.5px; font-weight: 500; margin-bottom: 8px; }
      .card-meta { display:flex; gap:6px; flex-wrap:wrap; margin-bottom: 8px; }
      .tag { font-size: 10.5px; letter-spacing:.5px; text-transform:uppercase; border-radius: 3px; padding: 2px 7px; }
      .tag.player { background: rgba(110,156,208,.15); color: var(--ct); }
      .tag.map { background: rgba(87,198,142,.12); color: var(--accent); }
      .card-actions { display:flex; gap:6px; }
      .card-actions button { background: var(--panel-2); border:1px solid var(--line); color: var(--muted); border-radius:3px; padding: 2px 8px; cursor:pointer; font-size: 12px; }
      .card-actions button:hover { color: var(--text); border-color: var(--muted); }
      .card-actions .del { margin-left:auto; }
      .card-actions .del:hover { color: var(--danger); }
      .col-empty { color: var(--muted); font-size: 12px; text-align:center; padding: 24px 0; border:1px dashed var(--line); border-radius:4px; }

      /* posições - scoreboard */
      .scoreboard { border:1px solid var(--line); border-radius: var(--radius); overflow:hidden; }
      .sb-row { display:grid; grid-template-columns: 200px 1fr 1fr; border-top:1px solid var(--line); }
      .sb-row:first-child { border-top:none; }
      @media (max-width: 700px) { .sb-row { grid-template-columns: 1fr; } .sb-row.sb-head { display:none; } }
      .sb-head { background: var(--panel-2); font-family: var(--display); text-transform:uppercase; letter-spacing:2px; font-size:14px; }
      .sb-head > div { padding: 10px 12px; }
      .sb-side.t { color: var(--t); border-left: 3px solid var(--t); }
      .sb-side.ct { color: var(--ct); border-left: 3px solid var(--ct); }
      .sb-player { padding: 10px 12px; display:flex; flex-direction:column; gap:2px; justify-content:center; }
      .sb-player .role { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
      .sb-cell { padding: 8px; }
      .sb-cell.t { background: linear-gradient(90deg, rgba(227,168,82,.06), transparent); border-left: 3px solid var(--t-dim); }
      .sb-cell.ct { background: linear-gradient(90deg, rgba(110,156,208,.06), transparent); border-left: 3px solid var(--ct-dim); }
      .sb-cell input { width: 100%; box-sizing: border-box; }

      /* táticas */
      .tactic-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
      .tactic { background: var(--panel-2); border:1px solid var(--line); border-radius: var(--radius); padding: 12px; }
      .tactic[data-side="TR"] { border-top: 3px solid var(--t); }
      .tactic[data-side="CT"] { border-top: 3px solid var(--ct); }
      .tactic-head { display:flex; gap:8px; align-items:center; margin-bottom: 8px; }
      .tactic-name { flex:1; font-weight: 600; font-size: 14px; background:none; border:none; border-bottom:1px solid transparent; border-radius:0; padding: 4px 2px; }
      .tactic-name:focus { border-bottom-color: var(--accent); }
      .side-badge { font-family: var(--display); font-size: 14px; letter-spacing: 1px; padding: 2px 10px; border-radius: 3px; }
      .side-badge.t { background: var(--t); color:#17130A; }
      .side-badge.ct { background: var(--ct); color:#0C1420; }
      .tactic-meta { display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; }

      /* vídeos */
      .video-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
      .video-card { background: var(--panel-2); border:1px solid var(--line); border-radius: var(--radius); overflow:hidden; display:flex; flex-direction:column; }
      .video-thumb { position:relative; display:block; aspect-ratio: 16/9; background: #0D1110; }
      .video-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .video-thumb .play { position:absolute; inset:0; display:grid; place-items:center; color: var(--accent); font-size: 26px; text-shadow: 0 0 12px rgba(0,0,0,.8); opacity:.85; transition: opacity .15s, transform .15s; }
      .video-thumb:hover .play { opacity:1; transform: scale(1.15); }
      @media (prefers-reduced-motion: reduce) { .video-thumb:hover .play { transform:none; } }
      .video-body { padding: 10px 12px 8px; display:flex; flex-direction:column; gap:8px; flex:1; }
      .video-title { color: var(--text); font-weight:600; font-size: 13.5px; text-decoration:none; line-height:1.35; }
      .video-title:hover { color: var(--accent); }
      .video-foot { display:flex; justify-content:space-between; align-items:center; margin-top:auto; }
      .video-date { color: var(--muted); font-size: 11px; }

      /* agenda */
      .event-list { display:flex; flex-direction:column; gap:10px; }
      .event { display:flex; gap:14px; background: var(--panel-2); border:1px solid var(--line); border-radius: var(--radius); padding: 12px; flex-wrap:wrap; }
      .event-when { display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:86px; border-right:1px solid var(--line); padding-right:12px; }
      .event-date { font-family: var(--display); font-size: 17px; letter-spacing:1px; color: var(--accent); }
      .event-time { color: var(--muted); font-size: 12px; }
      .event-main { flex:1; min-width: 200px; display:flex; flex-direction:column; gap:6px; }
      .event-title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .event-rsvps { display:flex; gap:5px; flex-wrap:wrap; }
      .rsvp-chip { font-size: 11px; border-radius: 999px; padding: 2px 9px; border:1px solid var(--line); color: var(--muted); }
      .rsvp-chip.yes { border-color:#2E4536; color:#8FCB9B; background: rgba(87,198,142,.08); }
      .rsvp-chip.no { border-color:#4A2A2A; color: var(--danger); }
      .rsvp-chip.maybe { border-color:#4a4327; color: var(--t); }
      .event-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }

      /* partidas */
      .record-strip { display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 14px; }
      .record-item { background: var(--panel-2); border:1px solid var(--line); border-radius: 4px; padding: 6px 12px; display:flex; flex-direction:column; gap:1px; }
      .record-map { font-size: 11px; text-transform:uppercase; letter-spacing:1px; color: var(--muted); }
      .record-score { font-size: 13px; }
      .record-score .win { color:#8FCB9B; }
      .record-score .loss { color: var(--danger); }
      .match-list { display:flex; flex-direction:column; gap:8px; }
      .match { display:flex; align-items:flex-start; gap:12px; background: var(--panel-2); border:1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; }
      .result-badge { font-family: var(--display); font-size: 18px; width: 32px; height: 32px; display:grid; place-items:center; border-radius: 4px; flex-shrink:0; }
      .result-badge.v { background: rgba(87,198,142,.15); color:#8FCB9B; border:1px solid #2E4536; }
      .result-badge.d { background: rgba(208,110,110,.12); color: var(--danger); border:1px solid #4A2A2A; }
      .result-badge.e { background: var(--panel); color: var(--muted); border:1px solid var(--line); }
      .match-main { flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
      .match-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size: 13.5px; }
      .match-notes { width:100%; box-sizing:border-box; font-size: 12.5px; }

      /* veto */
      .veto-row { grid-template-columns: 120px auto 1fr; }
      @media (max-width: 700px) { .veto-row { grid-template-columns: 1fr; } }
      .veto-pref[data-pref="Pick"] { box-shadow: inset 3px 0 0 var(--accent); }
      .veto-pref[data-pref="Ban"] { box-shadow: inset 3px 0 0 var(--danger); }

      /* time */
      .roster { display:flex; flex-direction:column; gap:8px; }
      .roster-card { display:flex; align-items:center; gap:10px; background: var(--panel-2); border:1px solid var(--line); border-radius: 4px; padding: 8px 12px; flex-wrap:wrap; }
      .roster-num { font-family: var(--display); color: var(--accent); font-size: 16px; letter-spacing:1px; width: 26px; }
      .roster-name { flex: 1 1 140px; font-weight: 600; }
    `}</style>
  );
}
