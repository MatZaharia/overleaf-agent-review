# Third-party notices

`vendor/treeOperations.js`, `projectFiles.js`, `staleGuard.js`, and `inlineReviewPreview.js` derive from codex-overleaf-link by Hengquan Guo, https://github.com/Ghqqqq/codex-overleaf-link (MIT). The original license is preserved in vendor/LICENSE and bundled by this distribution. treeOperations.js was changed to inject the ProjectFiles dependency instead of reading its global binding.

The development demo embeds CodeMirror packages, MIT licensed, copyright Marijn Haverbeke and others. CodeMirror is only used by the demo; the extension uses the editor already provided by Overleaf.

Character-level changes use jsdiff 9.0.0 (BSD-3-Clause), https://github.com/kpdecker/jsdiff. License: vendor/jsdiff-LICENSE. inlineReviewPreview.js was also modified to highlight disjoint character changes.
