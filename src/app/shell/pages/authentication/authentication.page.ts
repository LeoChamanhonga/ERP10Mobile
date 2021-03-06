import { Component, OnInit, NgZone } from '@angular/core';
import { AuthenticationService, StorageService, InstanceService, HttpRequestService } from '../../../core/services';
import { Router, ActivatedRoute } from '@angular/router';
import { AppSettings } from '../../../core/app-settings';
import { AlertController, NavController, MenuController, LoadingController } from '@ionic/angular';
import { InstancesService, InstancesServiceProvider, InstancesDemoService, InstanceServiceFactory } from '../../services';
import { TranslateService } from '@ngx-translate/core';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { PageBase } from '../../../shared/pages';
import { Location } from '@angular/common';
import { async } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';

@Component({
    templateUrl: './authentication.page.html',
    styleUrls: ['./authentication.page.scss'],
    // providers: [InstancesServiceProvider]
})
export class AuthenticationPage extends PageBase implements OnInit {

    constructor(
        public loadingController: LoadingController,
        public location: Location,
        public menuController: MenuController,
        private authenticationService: AuthenticationService,
        private http: HttpClient,
        private httpRequestService: HttpRequestService,
        private instanceService: InstanceService,
        private translateService: TranslateService,
        private route: ActivatedRoute,
        private appSettings: AppSettings,
        private alertController: AlertController,
        private storageService: StorageService,
        private zone: NgZone,
        private splashScreen: SplashScreen,
        private navController: NavController
    ) {
        super(loadingController, location, menuController);
    }

    /**
    * Execute on page initialization.
    *
    * @memberof AuthenticationPage
    */
    async ngOnInit() {

        this.splashScreen.hide();
        const logout = this.route.snapshot.queryParams['logout'];
        if (logout) {
            // await this.showLoading();
            await this.endSession();
            // await this.hideLoading();
        }

        const isAuthenticated = await this.authenticationService.isAuthenticate();

        if (isAuthenticated) {
            await this.showLoading();
            await this.goToInstanceSelectorPage();
            await this.hideLoading();
        }
    }

    async loginAction() {

        if (this.appSettings.isMobilePlatform) {
            await this.showLoading();
            const isAuthenticated = await this.authenticationService.authenticate();
            if (isAuthenticated) {
                await this.goToInstanceSelectorPage();
            }
            await this.hideLoading();
        } else {
            const okButton = await this.translateService.get('SHARED.ALERTS.OK').toPromise();
            const alert = await this.alertController.create({
                header: 'Authentication',
                message: 'The authentication can only be performed when the app is running on a mobile device. Starting in demo.',
                buttons: [{
                    text: okButton,
                    handler: () => {
                        this.demoAction();
                    }
                }]
            });

            await alert.present();
        }
    }

    async demoAction() {
        await this.authenticationService.authenticateAsDemoAsync();
        this.goToInstanceSelectorPage();
    }

    protected getMenuId(): string {
        return null;
    }

    private async goToInstanceSelectorPage(): Promise<any> {

        const instancesService = InstanceServiceFactory(this.http, this.httpRequestService, this.authenticationService);

        const instances = await instancesService.getInstancesAsync();

        // no instances available
        if (!instances || instances.length === 0) {
            const message = await this.translateService.get('SHELL.AUTHENTICATION.NO_SUBSCRIPTION_MESSAGE').toPromise();
            const okButton = await this.translateService.get('SHARED.ALERTS.OK').toPromise();
            const alert = await this.alertController.create({
                message: message,
                buttons: [{
                    text: okButton,
                    handler: () => {
                        this.demoAction();
                    }
                }]
            });

            await alert.present();
            await this.endSession();

            return;
        }

        // only one instance available.
        // go directly to the dashboard
        if (instances.length === 1) {
            await this.instanceService.setCurrentInstanceAsync(instances[0]);
            this.zone.run(() => this.navController.navigateRoot('/shell/dashboard', { replaceUrl: true}));
            return;
        }

        // more than one instance availabe. Go to the instance selector
        const extras = {
            replaceUrl: true,
            queryParams: {
                instances: JSON.stringify(instances),
            }
        };

        this.zone.run(() => this.navController.navigateRoot(['/shell/instances'], extras));
    }

    private async endSession() {
        await this.storageService.clear();
        await this.authenticationService.endSession();
    }
}
