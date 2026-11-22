import type { Mail } from "../lib/mailer.js";

// Textos de los emails de cuenta, en voseo. En la Épica 13 pasan a plantillas editables desde el admin.
const wrap = (title: string, body: string, link: string, cta: string) => ({
  html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#171717">
<h1 style="font-size:20px">${title}</h1><p>${body}</p>
<p><a href="${link}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${cta}</a></p>
<p style="font-size:12px;color:#666">Si el botón no funciona, copiá este link en tu navegador:<br>${link}</p></div>`,
});

export function verifyEmail(to: string, link: string): Mail {
  return {
    to, subject: "Confirmá tu email en MiShowo",
    text: `¡Bienvenido a MiShowo!\n\nConfirmá tu email para poder publicar tu página:\n${link}\n\nEl enlace vale 24 horas. Si no creaste una cuenta, ignorá este mensaje.`,
    ...wrap("¡Bienvenido a MiShowo!", "Confirmá tu email para poder publicar tu página. El enlace vale 24 horas.", link, "Confirmar mi email"),
  };
}

export function resetEmail(to: string, link: string): Mail {
  return {
    to, subject: "Restablecé tu contraseña de MiShowo",
    text: `Pediste restablecer tu contraseña:\n${link}\n\nEl enlace vale 1 hora. Si no fuiste vos, ignorá este mensaje: tu contraseña sigue igual.`,
    ...wrap("Restablecé tu contraseña", "Tocá el botón para elegir una nueva. El enlace vale 1 hora. Si no fuiste vos, ignorá este mensaje.", link, "Elegir nueva contraseña"),
  };
}

export function magicEmail(to: string, link: string): Mail {
  return {
    to, subject: "Tu enlace para entrar a MiShowo",
    text: `Entrá a MiShowo con este enlace:\n${link}\n\nVale 15 minutos y se puede usar una sola vez. Si no lo pediste, ignorá este mensaje.`,
    ...wrap("Entrá a MiShowo", "Tocá el botón para entrar sin contraseña. Vale 15 minutos y se puede usar una sola vez.", link, "Entrar a MiShowo"),
  };
}
