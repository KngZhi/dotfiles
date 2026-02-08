;;; init.el --- My Emacs config -*- lexical-binding: t; -*-

;; Custom 设置放到单独文件，避免污染 init.el
(setq custom-file (expand-file-name "custom.el" user-emacs-directory))
(when (file-exists-p custom-file)
  (load custom-file))

;; macOS GUI Emacs 需要从 shell 继承环境变量
(use-package exec-path-from-shell
  :ensure t
  :if (memq window-system '(mac ns))
  :config
  (exec-path-from-shell-initialize)
  (exec-path-from-shell-copy-env "OPENROUTER_API_KEY"))

;; crafted-emacs 模块路径 (已在 early-init.el 中通过 my/crafted-modules-path 设置)
(add-to-list 'load-path my/crafted-modules-path)

;; 先加载包配置
(require 'crafted-package-config)     ;; 包管理配置

;; 加载包列表（包括 evil）
(require 'crafted-evil-packages)      ;; Evil 包配置
(require 'crafted-completion-packages) ;; Vertico/Consult/Orderless 包（已包含 embark-consult）

;; 安装缺失的包
(package-install-selected-packages)

;; 加载各个模块
(require 'crafted-defaults-config)    ;; 更合理的内置默认值
(require 'crafted-ui-config)          ;; 美化 UI / modeline
(require 'crafted-org-config)         ;; Org-mode 友好设置
(require 'crafted-osx-config)
(require 'crafted-evil-config)        ;; Evil 模式配置
(require 'crafted-completion-config)  ;; 启用 Vertico/Consult/Orderless

;; 立即加载 embark-consult 集成（消除启动警告）
(require 'embark-consult)
(tool-bar-mode -1)
(load-theme 'modus-vivendi t)

;; Markdown 语法高亮
(use-package markdown-mode
  :ensure t
  :mode ("\\.md\\'" . markdown-mode)
  :init (setq markdown-command "multimarkdown"))

(global-set-key (kbd "C-w") 'backward-kill-word)
(global-set-key (kbd "s-x") 'execute-extended-command)

(defun reload-init-file ()
  "Reload the Emacs init.el file."
  (interactive)
  (load-file (expand-file-name "init.el" user-emacs-directory))
  (message "Init.el reloaded"))

(global-set-key (kbd "<f2>") 'reload-init-file)

(setq org-todo-keywords
      '((sequence "TODO(t)" "DOING(i)" "WAIT(w@/!)" "|" "DONE(d)" "CANCELED(c)")))

(setq org-todo-keyword-faces
      '(("TODO" . (:foreground "blue" :weight bold))
        ("DOING" . (:foreground "orange" :weight bold))
        ("BLOCKED" . (:foreground "red" :weight bold))
        ("DONE" . (:foreground "green" :weight bold))
        ("CANCELED" . (:foreground "gray" :weight bold))))

(setq display-line-numbers-type 'relative)
(global-display-line-numbers-mode t)
(setq org-capture-templates
      '(("c" "New Container" entry
         (file+headline "~/repo/org/containers.org" "Containers")
         "* TODO %^{Title}\n:PROPERTIES:\n:SHIP_DATE:    %^{Ship}t\n:ARRIVAL_DATE: %^{Arrival}t\n:PICKUP_DATE:  %^{Pickup}t\n:END:\n%?")))

(global-set-key (kbd "s-<backspace>") 'my/kill-to-bol)
(defun my/kill-to-bol ()
  "Kill text from point back to beginning of line, like macOS ⌘⌫."
  (interactive)
  (kill-line 0))            ; 0 表示“向前杀到行首”（Emacs 自带）

(setq org-agenda-files '("~/repo/org/"))


(defun my/move-end-of-line ()
  (interactive) (move-end-of-line 1))

(with-eval-after-load 'evil
  ;; 把 motion state 原来的 C-e 解绑（可选；直接覆盖也行）
  (define-key evil-motion-state-map (kbd "C-e") nil)
  (evil-define-key '(normal insert visual replace operator motion emacs)
      'global (kbd "C-a") 'move-beginning-of-line)

  ;; 这里挑一种你想要的函数：my/move-end-of-line 或 my/kill-to-eol
  (evil-define-key '(normal insert visual replace operator motion emacs)
      'global (kbd "C-e") #'my/move-end-of-line)

)

;; 使用 general.el 设置 SPC 为 leader key
(use-package general
  :ensure t
  :after evil
  :config
  (general-create-definer my/leader-keys
    :keymaps '(normal visual)
    :prefix "SPC")

  (my/leader-keys
    "g" '(:ignore t :which-key "gptel")
    "gg" 'gptel
    "gs" 'gptel-send
    "gq" 'gptel-quick
    "gr" 'gptel-rewrite
    "gm" 'gptel-menu))


;; Emacs 28+
(setq tab-bar-select-tab-modifiers '(super)) ; 让 s-1…s-9 直接选标签
(setq tab-bar-tab-hints t)             ; 在 tab 上显示 ①②③ 提示
(tab-bar-mode 1)

;; 只改 Tab Bar，不影响其余界面
(dolist (face '(tab-bar                ; 整个条
                tab-bar-tab            ; 当前 Tab
                tab-bar-tab-inactive)) ; 其他 Tab
  (set-face-attribute face nil :height 220))  ; 140 = 放大 1.4 倍



;; 所有备份文件（…~）统一放到 ~/.emacs.d/backups
(let ((backup-dir (expand-file-name "backups/" user-emacs-directory)))
  (unless (file-exists-p backup-dir)
    (make-directory backup-dir t))
  (setq backup-directory-alist `(("." . ,backup-dir))))

;; 所有自动保存文件（.#… 或 #…#）
(let ((auto-save-dir (expand-file-name "auto-saves/" user-emacs-directory)))
  (unless (file-exists-p auto-save-dir)
    (make-directory auto-save-dir t))
  (setq auto-save-file-name-transforms
        `((".*" ,auto-save-dir t))))

;; 如果愿意，也可以把 lock files (.#filename) 关闭
(setq create-lockfiles nil)

;; 2. Refile 目标：每个文件抓 ≤3 层标题
(setq org-refile-targets
      '((org-agenda-files :maxlevel . 1)))

;; 3. 路径显示 & 补全体验
(setq org-refile-use-outline-path 'file)  ; 文件名/路径/标题
(setq org-outline-path-complete-in-steps nil) ; 一步补全
(setq org-refile-use-cache t)             ; 缓存加速

;; 4. 可选：允许补全时直接新建父节点（回车⇢y）
(setq org-refile-allow-creating-parent-nodes 'confirm)

(use-package gptel
  :ensure t
  :pin melpa
  :bind
  (("C-c g g" . gptel)           ;; 打开聊天 buffer
   ("C-c g s" . gptel-send)      ;; 发送选区，回复插入 buffer
   ("C-c g q" . gptel-quick)     ;; 快速问答，弹窗显示
   ("C-c g r" . gptel-rewrite)   ;; 改写选中文本
   ("C-c g m" . gptel-menu))     ;; 菜单（切换模型等）
  :config
  (setq gptel-backend
        (gptel-make-openai "OpenRouter"
          :host "openrouter.ai"
          :endpoint "/api/v1/chat/completions"
          :stream t
          :key (lambda () (getenv "OPENROUTER_API_KEY"))
          :models '(anthropic/claude-sonnet-4
                    anthropic/claude-opus-4
                    openai/gpt-4o
                    google/gemini-2.5-pro-preview
                    deepseek/deepseek-r1)))
  (setq gptel-model 'anthropic/claude-sonnet-4))

;; Treemacs - 侧边栏文件树 (像 VS Code)
(use-package treemacs
  :ensure t
  :defer t
  :bind
  (("s-b" . treemacs)              ;; Cmd+B 切换侧边栏
   ("s-1" . treemacs-select-window)) ;; Cmd+1 跳到侧边栏
  :config
  (setq treemacs-width 35)
  (setq treemacs-position 'left)
  (treemacs-follow-mode t)         ;; 自动跟随当前文件
  (treemacs-filewatch-mode t))     ;; 监听文件变化

(use-package treemacs-evil
  :ensure t
  :after (treemacs evil))

(use-package org-super-agenda
  :ensure t
  :pin melpa
  :after org-agenda
  :config
  (org-super-agenda-mode 1)
  (setq org-super-agenda-groups
        '((:name "🔥 Urgent & Important"
           :priority "A"
           :deadline past
           :order 1)
          (:name "📅 Today"
           :time-grid t
           :date today
           :scheduled today
           :deadline today
           :order 2)
          (:name "🚀 In Progress"
           :todo "DOING"
           :order 3)
          (:name "🚢 Shipping & Logistics"
           :file-path "containers"
           :todo ("BOOK" "ARRIVING" "DELAY" "ADUANA")
           :order 4)
          (:name "💼 Work Tasks"
           :file-path "work"
           :order 5)
          (:name "📋 Projects"
           :file-path "projects"
           :order 6)
          (:name "⏳ Waiting"
           :todo "WAIT"
           :order 7)
          (:name "📝 Other TODOs"
           :todo "TODO"
           :order 8))))


(defun my/org-waiting-auto-schedule ()
  "当任务切到 WAIT 时，询问并设置下一次跟进的调度时间。"
  (when (string= org-state "WAIT")
    (let* ((default "+3d")  ;; 默认 3 天
           (spec (read-string (format "跟进间隔（Org 格式, 默认 %s）: " default)
                              nil nil default)))
      (org-schedule nil spec))))

(add-hook 'org-after-todo-state-change-hook
          #'my/org-waiting-auto-schedule)


(defun my/org-ctrl-ret-and-insert ()
  "在 Org 中执行 `org-insert-heading-respect-content`，
然后立即进入 `evil-insert-state`。"
  (interactive)
  (org-insert-heading-respect-content) ; 原本 C-RET 做的事
  (evil-insert-state))                 ; 切到 Insert

(with-eval-after-load 'org
  (with-eval-after-load 'evil
    (evil-define-key 'normal org-mode-map
      (kbd "C-<return>") #'my/org-ctrl-ret-and-insert)))
(defun my/find-file-in-new-tab (filename &optional wildcards)
  "像 `find-file` 一样读入 FILENAME，但：
- 如果 FILENAME 已在可见标签页中显示，则跳转过去；
- 否则新建一个标签页并打开该文件。"
  (interactive
   (find-file-read-args "Find file (new tab if needed): " nil))
  (let* ((buf    (find-buffer-visiting filename))
         ;; t ⇒ 所有 frame 中可见窗口都算
         (window (and buf (get-buffer-window buf t))))
    (if window
        ;; 已经可见：切过去
        (select-window window)
      ;; 否则：新建 tab 后打开
      (tab-bar-new-tab)
      (find-file filename))))

;; 可选：把原来的 find-file 直接重定向
(defun my/project-find-file-new-tab ()
  "在新 tab 中打开项目文件，取消时关闭新 tab。"
  (interactive)
  (let ((original-tab (tab-bar--current-tab-index)))
    (tab-bar-new-tab)
    (condition-case nil
        (call-interactively #'project-find-file)
      (quit (tab-bar-close-tab)))))

(global-set-key (kbd "s-p") #'my/project-find-file-new-tab)  ;; Cmd+P 新 tab 打开项目文件

(global-set-key (kbd "C-c a") 'org-agenda)
;; Make <ESC> act like "quit" (close minibuffer, dialogs, etc.).
(global-set-key (kbd "<escape>") #'keyboard-escape-quit)

;; 项目搜索快捷键 (Vertico + Orderless 提供模糊匹配)
(global-set-key (kbd "C-c f f") 'project-find-file)  ;; 项目内模糊找文件
(with-eval-after-load 'consult
  (global-set-key (kbd "C-c f s") 'consult-ripgrep)  ;; 项目内内容搜索
  (global-set-key (kbd "C-c f b") 'consult-project-buffer)) ;; 项目 buffer
