import { Clipboard, Edit3, KeyRound, LogOut, Plus, PowerOff, School, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import type { AccessCode, Site } from "../types";
import { getDemoData, makeId, patchDemoData } from "../utils/storage";

export function AdminGeneralPage() {
  const [data, setData] = useState(() => getDemoData());
  const [message, setMessage] = useState("");
  const [editingSiteId, setEditingSiteId] = useState("");
  const [siteDraft, setSiteDraft] = useState({ name: "", city: "", coordinator: "" });
  const { logout } = useAuth();
  const navigate = useNavigate();

  function sync(next: typeof data, toast: string) {
    setData(next);
    patchDemoData(next);
    setMessage(toast);
  }

  function createSite() {
    const nextSite: Site = {
      id: makeId("sede"),
      name: `Sede ${data.sites.length + 1}`,
      city: "Nueva localidad",
      coordinator: "Pendiente",
    };
    sync({ ...data, sites: [...data.sites, nextSite] }, "Sede creada.");
  }

  function startEdit(site: Site) {
    setEditingSiteId(site.id);
    setSiteDraft({ name: site.name, city: site.city, coordinator: site.coordinator });
  }

  function saveSite() {
    const sites = data.sites.map((site) => (site.id === editingSiteId ? { ...site, ...siteDraft } : site));
    setEditingSiteId("");
    sync({ ...data, sites }, "Sede actualizada.");
  }

  function generateCode(role = "Alumno") {
    const site = data.sites[0]?.name ?? "Sede demo";
    const nextCode: AccessCode = {
      id: makeId("code"),
      role,
      site,
      code: `EDU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "Activo",
    };
    sync({ ...data, accessCodes: [nextCode, ...data.accessCodes] }, "Código generado.");
  }

  function deactivateCode(id: string) {
    sync(
      {
        ...data,
        accessCodes: data.accessCodes.map((code) => (code.id === id ? { ...code, status: "Inactivo" } : code)),
      },
      "Código desactivado.",
    );
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setMessage(`Código copiado: ${code}`);
  }

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main className="admin-dashboard page-fade">
      <header className="admin-hero">
        <div>
          <span>
            <Sparkles size={20} /> EduTic
          </span>
          <h1>Panel de administración general</h1>
          <p>Gestioná sedes y códigos de acceso desde un tablero claro y seguro.</p>
        </div>
        <Button variant="ghost" onClick={leave}>
          <LogOut size={19} />
          Salir
        </Button>
      </header>

      <section className="dashboard-stat-grid">
        <article>
          <School size={27} />
          <span>Sedes</span>
          <strong>{data.sites.length}</strong>
        </article>
        <article>
          <KeyRound size={27} />
          <span>Códigos activos</span>
          <strong>{data.accessCodes.filter((code) => code.status === "Activo").length}</strong>
        </article>
        <article>
          <Users size={27} />
          <span>Usuarios</span>
          <strong>{data.users.length}</strong>
        </article>
      </section>

      <section className="admin-grid">
        <article className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Sedes</h2>
              <p>Escuelas y coordinaciones disponibles.</p>
            </div>
            <Button onClick={createSite}>
              <Plus size={18} />
              Crear sede
            </Button>
          </div>
          <div className="site-card-grid">
            {data.sites.map((site) => (
              <div key={site.id} className="site-card">
                {editingSiteId === site.id ? (
                  <div className="admin-form">
                    <input value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} />
                    <input value={siteDraft.city} onChange={(event) => setSiteDraft({ ...siteDraft, city: event.target.value })} />
                    <input
                      value={siteDraft.coordinator}
                      onChange={(event) => setSiteDraft({ ...siteDraft, coordinator: event.target.value })}
                    />
                    <Button onClick={saveSite}>Guardar cambios</Button>
                  </div>
                ) : (
                  <>
                    <School size={25} />
                    <strong>{site.name}</strong>
                    <span>{site.city}</span>
                    <small>{site.coordinator}</small>
                    <Button variant="secondary" onClick={() => startEdit(site)}>
                      <Edit3 size={17} />
                      Editar sede
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel__heading">
            <div>
              <h2>Generar código</h2>
              <p>Creá accesos para nuevos usuarios.</p>
            </div>
          </div>
          <div className="quick-code-actions">
            {["Alumno", "Profesor", "Admin de sede"].map((role) => (
              <Button key={role} variant="secondary" onClick={() => generateCode(role)}>
                <KeyRound size={18} />
                {role}
              </Button>
            ))}
          </div>
        </article>

        <article className="admin-panel admin-panel--wide">
          <div className="admin-panel__heading">
            <div>
              <h2>Códigos de acceso</h2>
              <p>Copiá o desactivá códigos vigentes.</p>
            </div>
            <Button onClick={() => generateCode()}>
              <KeyRound size={18} />
              Generar código
            </Button>
          </div>
          <div className="modern-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Sede</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.accessCodes.map((code) => (
                  <tr key={code.id}>
                    <td>{code.role}</td>
                    <td>{code.site}</td>
                    <td>
                      <b>{code.code}</b>
                    </td>
                    <td>
                      <span className={code.status === "Activo" ? "table-status is-active" : "table-status"}>{code.status}</span>
                    </td>
                    <td className="table-actions">
                      <Button variant="secondary" onClick={() => copyCode(code.code)}>
                        <Clipboard size={17} />
                        Copiar código
                      </Button>
                      <Button variant="danger" onClick={() => deactivateCode(code.id)}>
                        <PowerOff size={17} />
                        Desactivar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      <Toast message={message} />
    </main>
  );
}
