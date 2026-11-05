# Detecção de Encontros
Programa em TypeScript/Node.js que processa arquivos de geolocalização e detecta
encontros físicos entre pessoas monitoradas: duas pessoas no mesmo timestamp, a
menos de 20 metros uma da outra. Cada encontro é classificado como protetiva,
faccao ou generico e gravado em um arquivo JSON.

## Como executar
Requisito: Node.js 24 ou superior, que executa TypeScript diretamente, sem etapa
de build. A solução foi testada na versão 24.22.1.

```bash
npm install
node src/index.ts data/dataset1.txt output/dataset1.json
```

O primeiro argumento é o arquivo de entrada e o segundo é o arquivo de saída.

- Os arquivos `.txt` não fazem parte da entrega, por causa do tamanho (até 638 MB).
  Para executar, baixe-os pelos links do desafio para a pasta `data/`.
- O `npm install` instala apenas as ferramentas de desenvolvimento (`typescript` e
  `@types/node`). O programa só usa módulos nativos do Node.
- Os resultados dos 7 datasets estão na pasta `output/`.
- Para verificar os tipos: `npm run typecheck`.


## Lógica
1. **Leitura em stream:** o arquivo é lido linha a linha, com `createReadStream` e
   `readline`, sem carregar tudo na memória.
2. **Conversão:** cada linha vira um objeto Registro, com os campos já tipados.
3. **Agrupamento por timestamp:** as linhas do mesmo instante são acumuladas em um
   grupo. Quando o timestamp muda, o grupo é processado e descartado.
4. **Comparação de pares:** dois laços, com j = i + 1, formam cada par uma única
   vez. Isso garante a regra de unicidade do desafio.
5. **Pré-filtro:** pares com diferença de latitude maior que 0,0002° são descartados
   antes do cálculo da distância para melhor performance do programa.
6. **Distância:** Fórmula de Haversine confirma a distância menor que 20 metros.
7. **Classificação:** todo par a menos de 20 metros recebe um único tipo, nesta
   prioridade.
   - protetiva: um é agressor do outro, testado nos dois sentidos
   - faccao: os dois têm a mesma facção, desconsiderando facção vazia
   - generico: qualquer outro encontro
8. **Saída:** os encontros são gravados em JSON, em ordem de timestamp.

## Por que esta abordagem
A escolha partiu da análise dos dados:

- **Os 7 arquivos estão ordenados por timestamp.** Por isso cada instante pode ser
  processado e descartado. A memória guarda só o grupo atual e os encontros
  encontrados, em vez de milhões de registros. Isso também resolve o limite de
  tamanho de string do Node, que impede ler o arquivo de 638 MB de uma só vez.
- **O pré-filtro atacou o maior custo.** No dataset 7, a comparação gastava cerca de
  21 segundos de um total de 29 segundos. Com o filtro, o tempo total caiu para cerca de 10 segundos, com saídas idênticas
  byte a byte.


## Decisões técnicas

- **Pré-filtro seguro:** A distância real nunca é menor que a
  diferença de latitude, portanto nenhum encontro se perde. A decisão final continua
  sendo do Haversine. A longitude ficou de fora porque o tamanho de 1 grau de
  longitude varia com a latitude.
- **Ordem do cálculo no Haversine:** as coordenadas são subtraídas em graus e só
  depois convertidas para radianos. Matematicamente é igual a converter antes, mas o
  arredondamento muda. Foram testadas as duas ordens, e só esta reproduz o valor do
  gabarito exatamente.
- **Facção comparada com `null`:** testar `!== null` evita classificar como `faccao`
  duas pessoas sem facção.
- **Vítima com quem não é seu agressor:** seria classificado como `generico`. Esse
  caso não ocorre nos 7 datasets.

## Resultados
| Dataset | Linhas     | Encontros | generico | faccao | protetiva | Tempo   |
|---------|------------|-----------|----------|--------|-----------|---------|
| 1       | 5.000      | 4         | 2        | 1      | 1         | 0,11 s  |
| 2       | 25.000     | 6         | 3        | 2      | 1         | 0,11 s  |
| 3       | 100.000    | 10        | 5        | 3      | 2         | 0,17 s  |
| 4       | 400.020    | 15        | 7        | 5      | 3         | 0,42 s  |
| 5       | 1.000.000  | 21        | 10       | 7      | 4         | 0,90 s  |
| 6       | 8.000.000  | 27        | 12       | 9      | 6         | 6,78 s  |
| 7       | 12.000.000 | 35        | 15       | 12     | 8         | 10,19 s |

Total: 118 encontros. As saídas dos datasets 1 e 2 foram comparadas campo a campo com
os gabaritos, com 100% de igualdade.
Os tempos são de uma execução de cada dataset, medidos de fora do programa, incluindo
a inicialização do Node. Eles variam entre rodadas e dependem da máquina.


## Uso de IA
Usei o Claude Code (modelo Claude Opus 5.5) como orientador durante todo o desafio. A
IA auxiliou no entendimento do problema, baixou e analisou os datasets, sugeriu a troca do readFileSync para o createReadStream para leitura de arquivos pesados e filtro latitude > 0.0002, também rodou o teste e montou a tabela de Resultados. Revisou o que escrevi, comparou as saídas com os gabaritos e executou as medições de tempo. Escrevi o código passo a passo, questionando cada parte.
