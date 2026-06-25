import { useMemo } from "react";
import {
  generateCertificate,
  installCertificate,
  openCertificateGuide,
  removeCertificate,
} from "../api";

export type CertHandlers = {
  onInstall: () => Promise<void>;
  onOpenGuide: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onRemove: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function useCertHandlers(
  refreshCert: () => Promise<void>,
  setError: (message: string | null) => void,
  openCertGuideModal: () => void,
): CertHandlers {
  return useMemo(
    () => ({
      onInstall: async () => {
        try {
          await installCertificate();
          await refreshCert();
          openCertGuideModal();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      },
      onOpenGuide: async () => {
        try {
          await openCertificateGuide();
          openCertGuideModal();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      },
      onGenerate: async () => {
        try {
          await generateCertificate();
          await refreshCert();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      },
      onRemove: async () => {
        try {
          await removeCertificate();
          await refreshCert();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      },
      onRefresh: refreshCert,
    }),
    [openCertGuideModal, refreshCert, setError],
  );
}