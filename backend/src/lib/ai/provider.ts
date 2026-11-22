// Punto de extensión para IA. NO hay ninguna llamada a APIs externas en esta etapa:
// el provider por defecto siempre responde "no disponible". Cuando se active, se implementa
// un provider real y se elige por env sin tocar el resto del código.

export interface GenerateSiteInput { idea: string }
export interface GenerateSiteOutput { name: string; tagline: string; description: string; categories: { name: string; products: { name: string; description: string }[] }[] }

export interface AiProvider {
  readonly name: string;
  readonly available: boolean;
  generateSite(input: GenerateSiteInput): Promise<GenerateSiteOutput>;
  catalogFromPhotos(photoUrls: string[]): Promise<GenerateSiteOutput["categories"]>;
  instagramPost(input: { businessName: string; productName: string }): Promise<string>;
  removeBackground(imagePath: string): Promise<string>;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("Esta función todavía no está disponible");
    this.name = "AiUnavailableError";
  }
}

const unavailable = async (): Promise<never> => {
  throw new AiUnavailableError();
};

export const stubProvider: AiProvider = {
  name: "stub",
  available: false,
  generateSite: unavailable,
  catalogFromPhotos: unavailable,
  instagramPost: unavailable,
  removeBackground: unavailable,
};

export function getAiProvider(): AiProvider {
  return stubProvider;
}
