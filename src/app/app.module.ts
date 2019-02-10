import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpModule, Http } from '@angular/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { CoreModule } from './core/core.module';
import { ShellModule } from './shell/shell.module';
import { SalesModule } from './sales/sales.module';
import { HumanResourcesModule } from './human-resources/human-resources.module';
import { CustomersModule } from './customers/customers.module';

import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import localeEs from '@angular/common/locales/es';

// add locales
registerLocaleData(localePt);
registerLocaleData(localeEs);


export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    declarations: [AppComponent],
    entryComponents: [],
    imports: [
        BrowserModule,
        IonicModule.forRoot({mode: 'ios'}),
         // IonicModule.forRoot(),
        TranslateModule.forRoot({
            loader: {
              provide: TranslateLoader,
              useFactory: (createTranslateLoader),
              deps: [HttpClient]
            }
        }),
        AppRoutingModule,
        CoreModule,
        ShellModule,
        SalesModule,
        HumanResourcesModule,
        CustomersModule
    ],
    providers: [
        StatusBar,
        SplashScreen,
        {
            provide: RouteReuseStrategy,
            useClass: IonicRouteStrategy
        }
    ],
    bootstrap: [
        AppComponent
    ]
})
export class AppModule {
}
