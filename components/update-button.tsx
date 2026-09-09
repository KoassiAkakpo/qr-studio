"use client";

import { useEffect, useState } from "react";
import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useSerwist } from "@serwist/next/react";

/**
 * Signale qu'un nouveau build est installé et attend, et le laisse prendre la
 * main sur un clic.
 *
 * Une PWA installée peut rester des semaines sur une version périmée sans que
 * rien ne le dise : le worker sert le cache, la page ne redemande jamais le
 * HTML. Le worker est donc construit avec `skipWaiting: false` (voir
 * [sw/index.ts](../sw/index.ts)) et c'est ce bouton qui décide du moment, plutôt
 * qu'un remplacement automatique qui mélangerait les chunks de deux builds dans
 * la page ouverte.
 */
export function UpdateButton() {
  const { serwist } = useSerwist();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    // `waiting` couvre aussi le worker déjà en attente au moment de
    // l'enregistrement — un onglet rouvert après un déploiement, par exemple.
    const onWaiting = () => setHasUpdate(true);
    // Le nouveau worker a pris le contrôle : la page peut recharger et obtenir
    // un jeu de chunks cohérent. Recharger avant, sur la seule réponse au
    // message, servirait encore l'ancien cache.
    const onControlling = () => window.location.reload();
    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
    return () => {
      serwist.removeEventListener("waiting", onWaiting);
      serwist.removeEventListener("controlling", onControlling);
    };
  }, [serwist]);

  // Rien au premier rendu, côté serveur comme côté client : l'état ne bascule
  // que dans un effet, donc l'hydratation ne peut pas diverger.
  if (!hasUpdate) return null;

  return (
    <Button
      size="compact-sm"
      radius="md"
      variant="light"
      loading={applying}
      leftSection={<IconRefresh size={16} />}
      onClick={() => {
        setApplying(true);
        serwist?.messageSkipWaiting();
      }}
    >
      Update
    </Button>
  );
}
