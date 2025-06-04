export const rovoDevContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    height: '100vh',
    boxSizing: 'border-box',
    backgroundColor: 'var(--vscode-editor-background)',
};

export const rovoDevPromptContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: '100px',
    position: 'fixed',
    bottom: 0,
    left: 0,
    padding: '10px 20px',
    borderTop: '1px solid var(--vscode-panel-border)',
    background: 'var(--vscode-sideBar-background)',
    zIndex: 1000,
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
};

export const rovoDevTextareaStyles: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    resize: 'none',
    padding: '12px 15px',
    outline: 'none',
    fontSize: '14px',
    marginRight: '10px',
};

export const chatMessagesContainerStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '800px',
    flex: '1 1 auto',
    overflowY: 'auto',
    padding: '20px',
    marginBottom: '110px',
    display: 'flex',
    flexDirection: 'column',
};

export const chatMessageStyles: React.CSSProperties = {
    width: '100%',
    marginBottom: '16px',
    padding: '12px',
    borderRadius: '8px',
    position: 'relative',
};

export const userMessageStyles: React.CSSProperties = {
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
    alignSelf: 'flex-end',
};

export const agentMessageStyles: React.CSSProperties = {
    backgroundColor: 'var(--vscode-editor-selectionBackground)',
    alignSelf: 'flex-start',
};

export const streamingMessageStyles: React.CSSProperties = {
    border: '1px dashed var(--vscode-activityBarBadge-background)',
};

export const messageHeaderStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
};

export const messageAuthorStyles: React.CSSProperties = {
    fontWeight: 'bold',
    color: 'var(--vscode-editor-foreground)',
    opacity: 0.8,
};

export const messageTimestampStyles: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--vscode-editor-foreground)',
    opacity: 0.6,
};

export const messageContentStyles: React.CSSProperties = {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--vscode-editor-foreground)',
};

export const toolCallBubbleStyles: React.CSSProperties = {
    margin: '8px 0',
    padding: '12px',
    border: '2px solid var(--vscode-terminal-border)',
    borderLeft: '4px solid var(--vscode-terminal-ansiGreen)',
    borderRadius: '6px',
    backgroundColor: 'var(--vscode-terminal-background)',
    fontFamily:
        "'SFMono-Medium', 'SF Mono', 'Segoe UI Mono', 'Roboto Mono', 'Ubuntu Mono', Menlo, Consolas, Courier, monospace",
};

export const toolCallHeaderStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: 'var(--vscode-terminal-foreground)',
};

export const toolCallIconStyles: React.CSSProperties = {
    marginRight: '8px',
    fontSize: '16px',
};

export const toolCallNameStyles: React.CSSProperties = {
    color: 'var(--vscode-terminal-ansiGreen)',
    fontSize: '14px',
};

export const toolCallArgsStyles: React.CSSProperties = {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'var(--vscode-textCodeBlock-background)',
    borderRadius: '4px',
    border: '1px solid var(--vscode-input-border)',
};

export const toolCallArgsPreStyles: React.CSSProperties = {
    margin: 0,
    fontSize: '12px',
    color: 'var(--vscode-terminal-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
};
