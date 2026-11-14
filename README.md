# Simulador de Algoritmo Genético: seleção de projetos do campus

Atividade prática de Inteligência Artificial, UFPI, período 2026.2.

- **Aplicação (GitHub Pages):** https://hedersonfranco.github.io/algoritmo-Genetico/
- **Repositório:** https://github.com/HedersonFranco/algoritmo-Genetico

## Autores

- Hederson Franco Benvindo Lima
- David Soares Pereira Junior
- João Guilherme Oliveira Pereira

## Descrição da solução

O problema é uma mochila binária 0/1: cada projeto tem nome, custo em reais e benefício em pontos; o objetivo é maximizar a soma dos benefícios sem ultrapassar o orçamento. A aplicação roda inteiramente no navegador (HTML, CSS e JavaScript, sem servidor) e inicia com os quatro projetos e o orçamento de R$ 7.000 da seção 6.1 do enunciado. É possível editar, adicionar e remover projetos (de 4 a 15).

### Representação

Cada solução é um cromossomo binário com um gene por projeto, na ordem da tabela (genes A, B, C…). O valor 1 indica que o projeto foi selecionado e 0 que foi excluído. Para cada solução são exibidos o cromossomo, os projetos escolhidos, o custo total, o benefício total e o saldo do orçamento.

Internamente os custos são guardados em centavos e os benefícios em centésimos de ponto (inteiros), e a comparação das razões benefício/custo é feita por multiplicação cruzada (`b_i·c_j < b_j·c_i`). Isso evita erros de arredondamento de ponto flutuante nas somas, na restrição de orçamento e nos desempates da reparação.

### Algoritmo (arquivo `js/ga.js`)

| Etapa | Implementação |
|---|---|
| População inicial | Cada gene sorteado independentemente: `rng() < 0,5` → 1, senão 0. |
| Reparação | Enquanto o custo ultrapassa o orçamento, remove o projeto selecionado com a menor razão benefício/custo; em empate, o de menor índice. Aplicada à população inicial e a todos os descendentes antes da avaliação. |
| Avaliação (aptidão) | Benefício total da solução reparada. A seleção vazia é válida e tem aptidão 0. |
| Seleção | Torneio: sorteia *k* candidatos **distintos** (Fisher–Yates parcial) e escolhe o de maior aptidão; em empate, o de menor índice na população. Cada pai vem de um torneio independente. |
| Cruzamento | Um ponto. A taxa é testada uma vez por par (`rng() < taxa`). O corte é sorteado entre o 1º e o penúltimo gene (corte após o gene 1 … L−1). Sem cruzamento, os filhos copiam os pais. |
| Mutação | Inversão de bits, taxa testada independentemente em cada gene de cada filho. |
| Elitismo | Os *E* melhores (maior aptidão; empate → menor índice) são copiados sem modificação. Com *E* = 0 não há preservação. |
| Nova geração | Vagas restantes preenchidas com descendentes, sempre com pais da população anterior. Se restar uma vaga, só o primeiro filho do último par é retido. O tamanho da população é constante; repetidos são permitidos. |
| Parada | Após o número configurado de gerações. O resultado final é a melhor solução de toda a execução, incluindo a geração 0. |

**Gerador pseudoaleatório:** mulberry32, implementado no próprio `ga.js` (sem biblioteca). A semente é reduzida módulo 2³² para inicializar o gerador. A ordem dos sorteios é fixa, o que torna a execução reprodutível com os mesmos dados, parâmetros e semente:

1. inicialização: para cada indivíduo, um sorteio por gene;
2. para cada par: torneio do pai 1 (*k* sorteios), torneio do pai 2 (*k* sorteios), sorteio do cruzamento, ponto de corte (só se houver cruzamento), mutação do filho 1 (um sorteio por gene), mutação do filho 2 (um sorteio por gene). Quando resta só uma vaga, o filho 2 também é gerado (para manter a sequência de sorteios), mas é descartado, e o log registra isso.

## Instruções de uso

1. Abra a aplicação no GitHub Pages (ou o arquivo `index.html` localmente, sem instalar nada).
2. Ajuste os projetos e os parâmetros. Campos inválidos ou vazios ficam destacados e bloqueiam a execução.
3. Qualquer alteração nos dados ou parâmetros pausa a execução e exige **Reiniciar** para ser aplicada.
4. Controles:
   - **Executar:** roda gerações em sequência até o limite; se estava pausado, retoma do estado atual.
   - **Pausar:** interrompe preservando população, histórico e estado do gerador aleatório.
   - **Avançar uma geração:** produz exatamente uma nova geração e permanece pausado.
   - **Reiniciar:** descarta o histórico, reaplica a semente configurada e cria a geração 0.
5. Ao atingir o número de gerações, a execução é encerrada e o painel passa a mostrar o **resultado final**.

### O que é exibido

- Geração atual, melhor aptidão da geração, aptidão média da população e melhor resultado acumulado.
- Melhor solução (cromossomo, projetos, custo, benefício e saldo).
- Histórico por geração em tabela e gráfico (melhor da geração, média e melhor acumulado).
- População da geração atual, com cromossomo, projetos, custo, saldo, aptidão e origem de cada indivíduo (inicial, elite ou filho de qual par).
- **Log textual** de cada geração: candidatos e vencedores dos torneios (indicando quando houve empate), pais, sorteio e ponto de corte, filhos, bits mutados, cada passo da reparação, avaliação e posição de cada filho, e indivíduos preservados pelo elitismo. O log completo pode ser baixado em `.txt`.
- **Animação** de qualquer geração do histórico, montada a partir dos eventos registrados pelo próprio motor (portanto fiel ao que ocorreu): destaque do vencedor de cada torneio, separação dos pais no ponto de corte, troca dos segmentos (cores de pai 1 e pai 2), bits mutados em magenta, remoção de projetos na reparação, elitismo e posição final. Há controle de velocidade e opção de pular.
- Botão **Executar testes de validação**, que roda os testes da seção 6 no próprio navegador.

Exemplo real de log (semente 42, geração 2, par 1):

```
Par 1: torneio 1: #15 1100 (apt. 12), #20 1000 (apt. 7) → vence #15; torneio 2: #18 0100 (apt. 5), #10 0001 (apt. 8) → vence #10.
  Pais: 1100 e 0001; cruzamento ocorreu (sorteio 0,707 < 80%); corte após o 1º gene: 1|100 + 0|001 → filhos 1001 e 0100.
  Mutação: filho 1: gene(s) 3 (C) invertido(s), 1001 → 1011; filho 2: sem mutação (0100).
  Reparação: filho 1: 1011 → 1001 → 1000 (removido C, depois D, menor razão benefício/custo); filho 2: 0100 já é viável, sem reparação.
  Avaliação: filho 1 = 1000, custo R$ 4.000,00, aptidão 7 → posição #2; filho 2 = 0100, custo R$ 3.000,00, aptidão 5 → posição #3.
```

## Parâmetros e validação

| Campo | Valor inicial | Regra |
|---|---|---|
| Projetos (nome, custo, benefício) | dados da seção 6.1 | 4 a 15 projetos; nome não vazio; custo > 0 com até 2 casas decimais; benefício ≥ 0 com até 2 casas decimais |
| Orçamento disponível | R$ 7.000,00 | finito, ≥ 0, até 2 casas decimais |
| Tamanho da população | 20 | inteiro ≥ 2 |
| Número de gerações | 50 | inteiro ≥ 1 (a população inicial é a geração 0) |
| Taxa de cruzamento | 80% | 0% a 100%, por par |
| Taxa de mutação | 5% | 0% a 100%, por gene |
| Tamanho do torneio | 2 | inteiro entre 2 e o tamanho da população |
| Indivíduos de elite | 1 | inteiro entre 0 e população − 1 |
| Semente aleatória | 42 | inteiro |

Valores monetários aceitam vírgula ou ponto como separador decimal (ex.: `7000,00` ou `7000.50`), sem separador de milhar. Não há limite máximo para população e gerações. As estatísticas de todas as gerações ficam sempre no histórico; os detalhes usados no log e na animação (eventos e população) são guardados para até 200.000 indivíduos no total. Com população 20, isso cobre 10.000 gerações; em execuções maiores, só os detalhes das gerações mais recentes são mantidos.

## Tecnologias e bibliotecas

HTML, CSS e JavaScript puros, executados no navegador. **Nenhuma biblioteca externa é usada.** O algoritmo genético e seus operadores (`js/ga.js`), o gerador pseudoaleatório com semente (mulberry32, em `js/ga.js`), o gráfico (`js/chart.js`, canvas) e as animações (`js/animation.js`, CSS) foram implementados pela equipe. As fontes Archivo e JetBrains Mono são carregadas do Google Fonts apenas para aparência, com fontes do sistema como alternativa.

## Estrutura

```
index.html            interface
css/style.css         estilos (tema claro e escuro)
js/ga.js              núcleo do algoritmo genético e logs (também roda no Node)
js/tests.js           testes de validação da seção 6 (navegador e Node)
js/run-tests-node.js  executa os testes no terminal: node js/run-tests-node.js
js/chart.js           gráfico da evolução
js/animation.js       animação das operações
js/app.js             controles, validação e renderização
```

## Resultados dos testes (seção 6)

Os resultados abaixo foram obtidos com `node js/run-tests-node.js`; o botão de testes da interface produz a mesma saída. **Todas as verificações passaram (5 de 5 seções).**

### 6.1 Dados de entrada

A. Melhoria da iluminação (R$ 4.000; 7), B. Instalação de bicicletários (R$ 3.000; 5), C. Aquisição de bancos (R$ 2.000; 3), D. Reforma de espaço de convivência (R$ 5.000; 8). Orçamento R$ 7.000. Ordem dos genes: A, B, C, D.

### 6.2 Avaliação de uma solução

- **Entrada:** 1100; orçamento R$ 7.000.
- **Saída:** projetos A e B; custo R$ 7.000,00; benefício 12; saldo R$ 0,00; viável; aptidão 12.
- A enumeração das 16 combinações devolveu exatamente as 9 soluções viáveis da tabela do enunciado, com os mesmos custos e benefícios (0000, 0001, 0010, 0011, 0100, 0110, 1000, 1010, 1100), e o ótimo 1100 com benefício 12.
- **Conclusão:** a função de avaliação está correta.

### 6.3 Reparação de uma solução inviável

- **Entrada:** 1111; orçamento R$ 7.000.
- **Saída:**
  - 1111 → custo R$ 14.000; benefício 23.
  - Remove C (menor razão benefício/custo) → 1101, custo R$ 12.000; benefício 20.
  - Remove D → 1100, custo R$ 7.000; benefício 12; viável.
- **Conclusão:** saída idêntica à de referência.

### 6.4 Cruzamento, mutação e seleção com escolhas controladas

- **Entrada:** pai 1 = 1100, pai 2 = 0011, corte após o 2º gene, cruzamento forçado, inversão apenas do 1º gene do filho 1.
- **Saída:**
  - Cruzamento: 11|00 + 00|11 → filho 1 = 1111; filho 2 = 0000.
  - Mutação: filho 1 = 0111; filho 2 = 0000.
  - Reparação do filho 1: 0111 → 0101 → 0100 (remove C e depois D). Filho 2 permanece 0000.
  - Avaliação: filho 1 = 0100, custo R$ 3.000, aptidão 5; filho 2 = 0000, custo R$ 0, aptidão 0.
- **Limites das taxas** (200 casos cada, com o gerador real): mutação 0% não inverteu nenhum gene; mutação 100% inverteu todos os genes antes da reparação; cruzamento 0% gerou filhos iguais aos pais; cruzamento 100% sempre cruzou, com corte entre o 1º e o penúltimo gene.
- **Seleção:** torneio entre 1000 (7), 0011 (11) e 1100 (12) → vence 1100. Empate entre #1 0110 (8) e #2 0001 (8), sorteados na ordem #2, #1 → vence #1; empate entre #2 e #3 → vence #2. Em 500 torneios com *k* igual ao tamanho da população, os candidatos foram sempre distintos.
- **Conclusão:** operadores conferem com os valores de referência. O filho 1 (aptidão 5) é pior que o pai 1 (12), o que é esperado e não indica erro.

### 6.5 Execução completa

- **Parâmetros:** população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio 2; 1 elite; semente 42.
- **Resultado:** cromossomo **1100**; projetos A e B; custo R$ 7.000,00; benefício **12**; saldo R$ 0,00; encontrado já na geração 0.

| Geração | 0 | 1 | 5 | 10 | 25 | 50 |
|---|---|---|---|---|---|---|
| Melhor da geração | 12 | 12 | 12 | 12 | 12 | 12 |
| Média da população | 7,60 | 9,45 | 11,35 | 12,00 | 11,25 | 11,15 |

Verificações: o histórico tem 51 registros (geração 0 + 50); a solução final é viável e seus totais conferem com o cromossomo; o melhor acumulado nunca diminui; com 1 elite, a melhor aptidão da população nunca diminui; o tamanho da população é 20 em todas as gerações; repetir a execução com a mesma semente reproduz exatamente todas as populações.

#### Efeito da taxa de mutação (sementes 1 a 5, demais parâmetros iguais)

| Mutação | Melhor benefício final por semente (1–5) | Média do melhor final | Execuções que atingiram 12 | Aptidão média da população (10 últimas gerações, média das 5 execuções) |
|---|---|---|---|---|
| 1% | 12, 12, 12, 12, 12 | 12,00 | 5/5 | 11,87 |
| 20% | 12, 12, 12, 12, 12 | 12,00 | 5/5 | 9,54 |

**Análise.** As duas taxas atingiram o ótimo em todas as execuções, quase sempre já na geração 0 (só a semente 3 precisou de 2 gerações com 1% e de 1 geração com 20%). Isso se explica pelo tamanho da instância: há apenas 2⁴ = 16 cromossomos, e a reparação gulosa transforma 4 deles (1100, 1101, 1110 e 1111) no ótimo 1100. Assim, cada indivíduo inicial tem 4/16 = 25% de chance de virar o ótimo, e a chance de uma população de 20 não conter nenhum é 0,75²⁰ ≈ 0,3%. Nesta instância, portanto, a taxa de mutação quase não influencia a melhor solução encontrada.

A diferença aparece na população: com 1% a população converge para cópias de 1100 (média próxima de 12), enquanto com 20% cerca de 0,8 gene por filho é invertido, o que mantém mais diversidade, mas também gera muitos descendentes piores, e a média cai para cerca de 9,5. O elitismo garante que a melhor solução não se perca em nenhum dos casos. Em instâncias maiores, uma taxa baixa tende a convergir cedo e pode estagnar em ótimos locais, enquanto uma taxa alta explora mais, mas se aproxima de uma busca aleatória; nenhuma das duas é superior em geral, e o resultado deste experimento não permite concluir que uma seja sempre melhor.

### 6.6 Limites de orçamento

- **Orçamento R$ 0:** após a reparação, os 20 indivíduos da geração 0 são 0000, com custo, benefício e aptidão zero. Todas as 51 gerações da execução completa (semente 42) contêm apenas 0000. Resultado final: 0000.
- **Orçamento R$ 14.000:** a avaliação de 1111 retorna custo R$ 14.000, benefício 23, saldo R$ 0, viável, sem reparação. Na execução completa com semente 42, a busca encontrou 1111 (benefício 23) já na geração 0.
- **Conclusão:** comportamento conforme o enunciado nos dois limites.
