# Dotfiles

Personal Linux desktop & CLI configuration files managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Directory Structure

```
dotfiles/
├── ags/        AGS (Aylur's GTK Shell) desktop widgets
├── alacritty/  Alacritty terminal emulator
├── hypr/       Hyprland compositor, hyprlock & hypridle configs
├── nvim/       Neovim IDE configuration (Lua & LSP)
├── opencode/   OpenCode AI assistant configuration & plugins
├── starship/   Starship cross-shell prompt configuration
├── superfile/  Superfile terminal file manager
├── tmux/       Tmux multiplexer & plugin configs
├── walker/     Walker application launcher & clipboard manager
└── wallust/    Wallust pywal-compatible color palette generator
```

## Setup & Installation Guide

### 1. System Dependencies

Install required packages (Arch Linux example):

```bash
sudo pacman -S git stow tmux neovim alacritty hyprland nodejs npm zoxide fzf ripgrep fd ags walker nautilus btop lazygit python-black prettier biome starship wallust
```

> **Font Note**: Install a Nerd Font (e.g. `ttf-jetbrains-mono-nerd` or `otf-font-awesome`) for icons in AGS, Neovim, Tmux, and Walker.

---

### 2. Clone Repository & Deploy Symlinks

```bash
git clone https://github.com/<your-username>/dotfiles.git ~/dotfiles
cd ~/dotfiles
stow */
```

---

### 3. Post-Clone Package Configuration

#### A. Tmux Plugin Manager (TPM)

```bash
git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm
~/.config/tmux/plugins/tpm/bin/install_plugins
```

#### B. AGS Desktop Widgets

```bash
cd ~/.config/ags
npm install
```

#### C. OpenCode AI Assistant

```bash
cd ~/.config/opencode
npm install
```

#### D. Shell Integration (Zoxide)

Add zoxide initialization to `~/.bashrc` or `~/.zshrc`:

```bash
eval "$(zoxide init bash)"
```

---

### 4. Unstow / Revert

To remove symlinks created for a specific package:

```bash
cd ~/dotfiles
stow -D package_name
```
