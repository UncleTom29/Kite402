/**
 * Card issuer abstraction — supports Lithic and Marqeta.
 * Returns raw card data that must be hashed immediately and never persisted.
 */

export interface IssuedCard {
  pan: string;
  cvv: string;
  expiry: string;   // MM/YY
  token: string;    // Issuer-specific card token for revocation
}

interface LithicCardResponse {
  token: string;
  pan: string;
  cvv: string;
  exp_month: string;
  exp_year: string;
  state: string;
}

interface MarqetaCardResponse {
  token: string;
  pan: string;
  cvv_number: string;
  expiration: string; // MMYY
}

export async function issueVirtualCard(usdcAmountCents: number): Promise<IssuedCard> {
  const issuer = process.env.CARD_ISSUER ?? 'lithic';

  if (issuer === 'lithic') {
    return issueLithic(usdcAmountCents);
  } else if (issuer === 'marqeta') {
    return issueMarqeta(usdcAmountCents);
  }

  throw new Error(`Unsupported card issuer: ${issuer}`);
}

async function issueLithic(amountCents: number): Promise<IssuedCard> {
  const res = await fetch(`${process.env.CARD_ISSUER_BASE_URL}/cards`, {
    method: 'POST',
    headers: {
      Authorization: `api-key ${process.env.CARD_ISSUER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'SINGLE_USE',
      spend_limit: amountCents,
      spend_limit_duration: 'TRANSACTION',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lithic card issuance failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as LithicCardResponse;

  return {
    pan: data.pan,
    cvv: data.cvv,
    expiry: `${data.exp_month}/${data.exp_year.slice(-2)}`,
    token: data.token,
  };
}

async function issueMarqeta(amountCents: number): Promise<IssuedCard> {
  const res = await fetch(`${process.env.CARD_ISSUER_BASE_URL}/cards`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(process.env.CARD_ISSUER_API_KEY!).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_product_token: 'virtual_card_product',
      spend_controls: {
        spend_limit: amountCents,
        spend_limit_duration: 'TRANSACTION',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Marqeta card issuance failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as MarqetaCardResponse;
  const month = data.expiration.slice(0, 2);
  const year = data.expiration.slice(2);

  return {
    pan: data.pan,
    cvv: data.cvv_number,
    expiry: `${month}/${year}`,
    token: data.token,
  };
}

export async function revokeCard(cardToken: string): Promise<void> {
  const issuer = process.env.CARD_ISSUER ?? 'lithic';

  if (issuer === 'lithic') {
    const res = await fetch(`${process.env.CARD_ISSUER_BASE_URL}/cards/${cardToken}`, {
      method: 'PATCH',
      headers: {
        Authorization: `api-key ${process.env.CARD_ISSUER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'CLOSED' }),
    });
    if (!res.ok) throw new Error(`Lithic revocation failed: ${res.status}`);
  }
}
