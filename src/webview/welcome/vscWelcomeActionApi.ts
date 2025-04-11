import { Container } from '../../container';
import { WelcomeActionApi } from '../../lib/webview/controller/welcome/welcomeActionApi';

export class VSCWelcomeActionApi implements WelcomeActionApi {
    openSettings() {
        Container.settingsWebviewFactory.createOrShow();
    }
}
