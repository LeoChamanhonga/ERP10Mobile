import { Component, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthenticationService, ModulesService } from '../../../core/services';
import { ModuleDefinition } from '../../../core/entities';

@Component({
    selector: 'side-menu',
    templateUrl: './side-menu.component.html',
    styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {

    @Input() contentId: string;

    modulesDefsWithSettings: ModuleDefinition[];

    constructor(
        private translateService: TranslateService,
        private router: Router,
        private alertController: AlertController,
        private modulesService: ModulesService
    ) {}

    /**
    * Execute on page initialization.
    *
    * @memberof SideMenuComponent
    */
    ngOnInit(): void {
        this.modulesDefsWithSettings = this.modulesService
                                           .getAvailabeModulesDefinitions()
                                           .filter(m => m.settings && m.settings.hasSettings);
    }


    /**
     * Show's logout confirmation window.
     *
     * @memberof DashboardPage
     */
    async logoutAction() {
        const header = await this.translateService.get('SHARED.SIDE_MENU_COMPONENT.ALERT_LOGOUT_HEADER').toPromise();
        const message = await this.translateService.get('SHARED.SIDE_MENU_COMPONENT.ALERT_LOGOUT_MESSAGE').toPromise();

        const alert = await this.alertController.create({
            header: header,
            message: message,
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel'
                },
                {
                    text: 'Ok',
                    handler: () => this.logout()
                }
            ]
        });

        await alert.present();
    }

    async changeInstancesAction() {
        this.router.navigate(['/shell/instances']);
    }

    private async logout() {
        // // If the router was used to navigate, the app page stack was not clean
        // window.location.href = '/shell/authentication?logout=true';
        this.router.navigate(
            ['/authentication'],
            {
                replaceUrl: true,
                queryParams: {
                    'logout': true
                }
            }
        );
    }
}
