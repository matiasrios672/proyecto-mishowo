import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16 sm:px-6">
      <Wordmark className="text-2xl" />
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Tu página que vende y crece con vos.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Armá la página de tu negocio desde el celular en minutos. Catálogo, pedidos por WhatsApp y
        un link listo para tu bio de Instagram.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" render={<Link href="/design-system" />}>
          Creá tu página gratis
        </Button>
      </div>
    </main>
  );
}
