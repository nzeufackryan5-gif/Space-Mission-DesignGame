import { useEffect, useState } from "react";
import type { PlayerRole } from "../../../shared/types/index";
import { getAvailableRolesByCode } from "../services/playerService";
import { roomErrorMessage } from "./roomErrorMessage";

/** Charge et actualise les rôles libres dès que le code de salle est complet. */
export function useAvailableRolesByCode(code: string, isComplete: boolean) {
  const [availableRoles, setAvailableRoles] = useState<PlayerRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isComplete) {
      setAvailableRoles([]);
      setIsLoadingRoles(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingRoles(true);
    void getAvailableRolesByCode(code)
      .then((roles) => {
        if (active) {
          setAvailableRoles(roles);
          setErrorMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAvailableRoles([]);
          setErrorMessage(roomErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setIsLoadingRoles(false);
      });

    return () => {
      active = false;
    };
  }, [code, isComplete]);

  return {
    availableRoles,
    isLoadingRoles,
    errorMessage,
    setErrorMessage,
  };
}
