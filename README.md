# RetroEmulator

Launcher de jogos retrô para Windows. Ele organiza a sua biblioteca de jogos, baixa sozinho o
[RetroArch](https://www.retroarch.com/) e o emulador de cada console, e abre o jogo com um duplo clique.

Nenhum jogo nem BIOS acompanha o projeto: você aponta as pastas onde estão os seus.

## Baixar e instalar

1. Baixe o arquivo `RetroEmulator-1.0.0-win64.zip` na página de
   [Releases](https://github.com/Fernandomanoel/Emulador-de-jogos-retro/releases/latest).
2. Extraia o zip em qualquer pasta.
3. Abra `RetroEmulator.exe`.
4. Em Configurações → Consoles e pastas, indique onde estão os seus jogos.

Precisa de Windows de 64 bits. Como o programa não tem assinatura digital, o Windows pode mostrar o aviso
"O Windows protegeu o computador"; clique em "Mais informações" e depois em "Executar assim mesmo".
Na primeira vez que você abrir um jogo, o app baixa o RetroArch (cerca de 200 MB).

## Consoles

| Console | Emulador (core do RetroArch) | Arquivos |
|---|---|---|
| Super Nintendo | snes9x | `.smc` `.sfc` `.fig` `.swc` `.bs` `.zip` |
| Mega Drive | genesis_plus_gx | `.md` `.gen` `.smd` `.sms` `.gg` `.zip` |
| Nintendo 8-bit | nestopia | `.nes` `.fds` `.zip` |
| Game Boy / Advance | mgba | `.gb` `.gbc` `.gba` `.zip` |
| Nintendo 64 | mupen64plus_next | `.z64` `.n64` `.v64` `.zip` |
| PlayStation | pcsx_rearmed | `.cue` `.chd` `.pbp` `.m3u` `.iso` |
| GameCube | dolphin | `.iso` `.rvz` `.gcm` `.gcz` `.ciso` `.wbfs` |

## O que o app faz

- Biblioteca com busca, favoritos e jogados recentemente; tema claro e escuro.
- Download automático do RetroArch e dos emuladores na primeira vez que são necessários.
- Teclado por console, com dois estilos prontos (moderno com WASD e "lan house") e dois jogadores.
- Navegação por controle no launcher (Xbox/XInput e DualShock 3 com o driver DsHidMini).
- Aba Controles com diagnóstico do driver, porta USB e teste ao vivo dos botões.
- Saves ficam ao lado do jogo; jogos de vários discos usam uma lista `.m3u`.

## Como rodar

Requer Windows de 64 bits e [Node.js](https://nodejs.org/).

```bash
npm install
```

```bash
npm start
```

Se o `npm install` não baixar o Electron (versões novas do npm bloqueiam o script de instalação), rode:

```bash
node node_modules/electron/install.js
```

## Gerar o .exe

```bash
npm run build
```

O app sai em `dist\RetroEmulator-win32-x64\RetroEmulator.exe`. Feche o app antes de gerar de novo.

O projeto usa o Electron 22 de propósito: é a última versão que abre no Windows 7 e 8.

## Estrutura

- `src/main.js`: janela e comunicação com a interface
- `src/consoles.js`: consoles, extensões e botões de cada um
- `src/installer.js`: download e extração do RetroArch e dos emuladores
- `src/launcher.js`: configuração e abertura do jogo
- `src/keyboard.js`: estilos de teclado e conversão para o RetroArch
- `src/controllers.js`: detecção de controles e drivers no Windows
- `src/library.js`: leitura das pastas de jogos
- `src/renderer/`: interface
- `scripts/`: geração do app e do ponteiro do mouse

Tudo que o app baixa ou grava (RetroArch, saves, configurações) fica na pasta `data/`, que não vai para o repositório.
