import './RovoDev.css';

import React, { useCallback, useState } from 'react';

import { useMessagingApi } from '../messagingApi';

const RovoDevView: React.FC = () => {
    const [promptText, setPromptText] = useState('');
    const [responseText, setResponseText] = useState(' ');

    const onMessageHandler = useCallback(
        (message: any): void => {
            switch (message.type) {
                case 'response': {
                    setResponseText((prevText) => prevText + message.text);
                    break;
                }
            }
        },
        [setResponseText],
    );

    const [postMessage] = useMessagingApi<any, any, any>(onMessageHandler);

    const sendPrompt = useCallback(
        (text: string): void => {
            setResponseText('');
            postMessage({
                type: 'prompt',
                text,
            });
        },
        [postMessage, setResponseText],
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendPrompt(promptText);
            }
        },
        [sendPrompt, promptText],
    );

    return (
        <div className="rovo-dev-container">
            <textarea
                className="rovo-dev-stream"
                placeholder="...waiting for a response..."
                readOnly={true}
                value={responseText}
            />
            <div className="rovo-dev-prompt-container">
                <textarea
                    className="rovo-dev-textarea"
                    placeholder="What do you want AcraMini to do?"
                    onChange={(element) => setPromptText(element.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <br />
                <button className="rovo-dev-send-button" onClick={() => sendPrompt(promptText)} title="Send prompt">
                    Send
                </button>
            </div>

            <br />
            <br />
        </div>
    );
};

export default RovoDevView;
