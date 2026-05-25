"use client";

import { DocumentBlank, Upload } from "@carbon/icons-react";
import { Button, ButtonSet, Tile } from "@carbon/react";

// V6.6 — prominent CTA when the org hasn't uploaded an IES yet.
// PRD §40 user story. Two ways forward: AI extraction or manual entry.
export function EconomicProfileCta() {
  return (
    <Tile>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.28, margin: 0 }}>
        Carregue o seu IES para desbloquear recomendações
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-700">
        A IA extrai os dados económicos chave (volume de negócios, EBITDA, colaboradores, CAE) e o
        bGreen pode começar a sugerir medidas adequadas ao seu perfil.
      </p>
      <div className="mt-4">
        <ButtonSet>
          <Button kind="secondary" href="/economic-profile/manual" renderIcon={DocumentBlank}>
            Entrada manual
          </Button>
          <Button kind="primary" href="/economic-profile/ies/new" renderIcon={Upload}>
            Carregar IES
          </Button>
        </ButtonSet>
      </div>
    </Tile>
  );
}
