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

    return (
        <div>
            <textarea
                placeholder="What do you want AcraMini to do?"
                onChange={(element) => setPromptText(element.target.value)}
            />
            <br />
            <button onClick={() => sendPrompt(promptText)}>Send</button>

            <br />
            <br />
            <textarea placeholder="...waiting for a response..." readOnly={true} value={responseText} />
        </div>
    );
};

export default RovoDevView;
