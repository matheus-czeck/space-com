import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const caminhoArquivo = process.argv[2];
const caminhoSaida = process.argv[3];

if (!caminhoArquivo || !caminhoSaida) {
  console.error("Uso: npm start -- <entrada.txt> <saida.json>");
  process.exit(1);

}

const leitor = createInterface({
  input: createReadStream(caminhoArquivo),
  crlfDelay: Infinity,
});


type TipoEncontro = "generico" | "faccao" | "protetiva";

type Encontro = {
  tipo: TipoEncontro;
  monitoradosEncontro: [number, number];
  timestamp: string;
  posicoes: Record<string, { lat: number; lon: number }>;
  distanciaMetros: number;
};

type Registro = {
  id: number;
  faccao: number | null;
  timestamp: string;
  lat: number;
  lon: number;
  vitima: boolean;
  agressores: number[];
};

const RAIO_TERRA = 6371000;
const LIMITE_LATITUDE = 0.0002;
const encontros: Encontro[] = [];

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const lat1Radianos = (lat1 * Math.PI) / 180;
  const lat2Radianos = (lat2 * Math.PI) / 180;
  
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
  Math.sin(deltaLat / 2) ** 2 +
  Math.cos(lat1Radianos) *
  Math.cos(lat2Radianos) *
  Math.sin(deltaLon / 2) ** 2;
  
  const d = 2 * RAIO_TERRA * Math.asin(Math.sqrt(a));
  
  return d;
}

function classificar(a: Registro, b: Registro): TipoEncontro {
  if (a.agressores.includes(b.id) || b.agressores.includes(a.id)) {
    return "protetiva";
  }
  if (a.faccao !== null && a.faccao === b.faccao) {
    return "faccao";
  }
  return "generico";
}

function processarGrupo(grupo: Registro[]) {
  for (let i = 0; i < grupo.length; i++) {
    for (let j = i + 1; j < grupo.length; j++) {
      const a = grupo[i];
      const b = grupo[j];
      
      if(Math.abs(a.lat - b.lat) > LIMITE_LATITUDE) continue;

      const distancia = haversine(a.lat, a.lon, b.lat, b.lon);
      
      if (distancia < 20) {
        encontros.push({
          tipo: classificar(a, b),
          monitoradosEncontro: [a.id, b.id],
          timestamp: a.timestamp,
          posicoes: {
            [a.id]: { lat: a.lat, lon: a.lon },
            [b.id]: { lat: b.lat, lon: b.lon },
          },
          distanciaMetros: distancia,
        });
      }
    }
  }
}

let primeiraLinha = true;
let timestampAtual = "";
let grupoAtual: Registro[] = [];

for await (const linhaBruta of leitor) {
  if (primeiraLinha) {
    primeiraLinha = false;
    continue;
  }
  const linha = linhaBruta.trim();
  if (linha === "") continue;

  const campos = linha.split(";");
  const idsLimpos = campos[6].replaceAll('"', "");

  const registro: Registro = {
    id: parseInt(campos[0]),
    faccao: campos[1] ? parseInt(campos[1]) : null,
    timestamp: campos[2].replaceAll('"', ""),
    lat: parseFloat(campos[3]),
    lon: parseFloat(campos[4]),
    vitima: campos[5] === "true",
    agressores:
      idsLimpos === "" ? [] : idsLimpos.split(",").map((id) => parseInt(id)),
  };

  if (registro.timestamp !== timestampAtual) {
    processarGrupo(grupoAtual);
    grupoAtual = [];
    timestampAtual = registro.timestamp;
  }
  grupoAtual.push(registro);
}

processarGrupo(grupoAtual);

writeFileSync(caminhoSaida, JSON.stringify(encontros, null, 2));
