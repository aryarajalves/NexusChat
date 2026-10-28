---
trigger: always_on
---

# Regra de Limites de Código (Clean Code)

Para garantir que o projeto permaneça manutenível e que o agente consiga processar os arquivos sem perder o contexto, estabelecemos limites rígidos de tamanho de arquivo.

**Limites Obrigatórios:**
1. **Backend (Python - `.py`):** Nenhum arquivo deve ultrapassar **1.000 linhas**.
2. **Frontend (React/JSX/JS e CSS - `.jsx`, `.js`, `.css`):** Nenhum arquivo deve ultrapassar **500 linhas** (lembre-se: arquivos de estilização CSS são considerados frontend).

**Protocolo Obrigatório de Verificação:**
1. **Verificação pós-implementação/atualização:** Toda vez que você criar um código novo ou atualizar qualquer arquivo existente, ao terminar, você **DEVE obrigatoriamente verificar** se algum desses códigos ultrapassou os limites estabelecidos.
2. **Alerta e pergunta de refatoração:** Se algum desses arquivos ultrapassar os limites (ou já estiver acima do limite), você **DEVE obrigatoriamente alertar o usuário**, listar os arquivos que excederam o tamanho com suas respectivas quantidades de linhas e **perguntar se pode fazer a refatoração/modularização**.
3. **Aguardar autorização do usuário:** Aguarde a confirmação do usuário antes de realizar a quebra estrutural. Ao propor a modularização, priorize a extração de componentes/estilos (frontend) e serviços/utilitários (backend) para arquivos separados e organizados.

Isso evita a criação de "Arquivos Monolíticos" que são difíceis de testar e debugar, mantendo o usuário sempre no controle do fluxo de refatoração.


