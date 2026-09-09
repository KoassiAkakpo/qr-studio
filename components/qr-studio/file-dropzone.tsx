"use client";

import { Group, Stack } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconUpload, IconX } from "@tabler/icons-react";
import { describeRejection } from "@/lib/dropzone-messages";

/**
 * Types acceptés, sous la forme MIME -> extensions.
 *
 * Les deux moitiés comptent : `attr-accept` compare le type MIME du fichier
 * *ou* la fin de son nom. Un `.csv` exporté par Excel arrive parfois avec le
 * type `application/vnd.ms-excel`, et un fichier glissé depuis certaines
 * archives arrive avec un type vide — l'extension est alors le seul recours.
 */
export type AcceptMap = Record<string, string[]>;

/**
 * Zone de dépôt pour un fichier unique : glisser-déposer, clic, clavier.
 *
 * Le contenu intérieur est inerte (`pointer-events: none` posé par Mantine), ce
 * qui autorise une vignette ou du texte à l'intérieur sans voler le clic. Les
 * boutons d'action doivent donc rester *à côté* de la zone, pas dedans.
 */
export function FileDropzone({
  onFile,
  onRejectMessage,
  accept,
  acceptLabel,
  maxSize,
  idleIcon,
  loading = false,
  disabled = false,
  mih = 92,
  inputLabel,
  children,
}: {
  onFile: (file: File) => void;
  onRejectMessage: (message: string) => void;
  accept: AcceptMap;
  /** Complète « That file is not … » : « an image (PNG, JPG…) ». */
  acceptLabel: string;
  maxSize: number;
  idleIcon: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  mih?: number;
  /** Nom accessible de l'input masqué — la zone n'a pas de <label>. */
  inputLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Dropzone
      // `onReject` part avant `onDrop` : déposer un fichier valide et un invalide
      // affiche donc brièvement l'erreur avant que le fichier retenu l'efface.
      onDrop={(files) => {
        const file = files[0];
        if (!file) return;
        onRejectMessage("");
        onFile(file);
      }}
      onReject={(rejections) =>
        onRejectMessage(describeRejection(rejections, { maxSize, acceptLabel }))
      }
      accept={accept}
      maxSize={maxSize}
      multiple={false}
      loading={loading}
      disabled={disabled}
      radius="md"
      inputProps={{ "aria-label": inputLabel }}
    >
      <Group justify="center" align="center" gap="md" wrap="nowrap" mih={mih} px="xs">
        <Dropzone.Accept>
          <IconUpload size={30} stroke={1.5} color="var(--mantine-color-blue-6)" />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={30} stroke={1.5} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <Dropzone.Idle>{idleIcon}</Dropzone.Idle>
        <Stack gap={2} style={{ minWidth: 0 }}>
          {children}
        </Stack>
      </Group>
    </Dropzone>
  );
}
