;; ── 0. 关闭所有自动原生编译 ─────────────────────────────────────────
(setq native-comp-async-report-warnings-errors nil   ; 别弹编译警告
      package-native-compile              nil        ; 包安装时不编
      inhibit-automatic-native-compilation t         ; 29+ 关闭一切自动编译
      native-comp-jit-compilation         nil        ; 28+ 关闭 JIT
      native-comp-enable-subr-trampolines nil)       ; 不生成 trampolines

;; 保留默认的 eln 缓存目录，避免报错
;; (setq native-comp-eln-load-path nil)


;; 让 Emacs 只用字节码，别再尝试 native-comp
(setq native-comp-deferred-compilation nil
      package-native-compile        nil)

;; 添加 crafted-emacs 模块到 load-path (相对于 emacs 目录)
(defvar my/crafted-modules-path
  (expand-file-name "../crafted-emacs/modules" user-emacs-directory))
(add-to-list 'load-path my/crafted-modules-path)

;; 加载 early-init 配置
(load (expand-file-name "crafted-early-init-config" my/crafted-modules-path))

(setq crafted-package-manager 'straight)
