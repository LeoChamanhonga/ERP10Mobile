import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule, Platform } from '@ionic/angular';
import { SafariViewController } from '@ionic-native/safari-view-controller/ngx';
import { NativeStorage } from '@ionic-native/native-storage/ngx';

import { SERVICES, StorageService } from './services';
import { NativeStorageService } from './services/storage/native-storage.service';
import { LocalStorageService } from './services/storage/local-storage.service';
import { AppSettings } from './app-settings';

@NgModule({
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        IonicModule,
    ],
    declarations: [],
    providers: [
        SERVICES,
        AppSettings,
        SafariViewController,
        NativeStorage,
        {
            provide: StorageService,
            useFactory: (nativeStorage: NativeStorage, platform: Platform) => {
                if (platform.is('cordova')) {
                    return new NativeStorageService(nativeStorage);
                } else {
                    return new LocalStorageService();
                }
            },
            deps: [NativeStorage, Platform]
        }
    ],
    entryComponents: []
})
export class CoreModule {
    constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
        if (parentModule) {
            throw new Error(
                'CoreModule is already loaded. Import it in the AppModule only');
        }
    }
}
