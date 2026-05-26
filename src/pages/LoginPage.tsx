import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "../types";
import { LoginCard } from "../components/auth/LoginCard";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { routeForRole } from "../utils/storage";

export function LoginPage() {
  const [role, setRole] = useState<Role>("alumno");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextUser = login(role, username.trim(), password);

    if (!nextUser) {
      setMessage("Revisá el rol, usuario y contraseña para ingresar.");
      return;
    }

    navigate(routeForRole(nextUser.role));
  }

  function enterDemo() {
    const nextUser = loginDemo(role);
    navigate(routeForRole(nextUser.role));
  }

  return (
    <main className="login-page page-fade" style={{ backgroundImage: `url("${assets.loginBg}")` }}>
      <img className="login-mascot login-mascot--left" src={assets.mascotFemaleWave} alt="Mascota saludando" />
      <img className="login-mascot login-mascot--right" src={assets.mascotMaleWave} alt="Mascota saludando" />

      <LoginCard
        role={role}
        username={username}
        password={password}
        onRoleChange={setRole}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={submit}
        onDemo={enterDemo}
      />

      <Toast message={message} />
    </main>
  );
}
