// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.core.sidemenu')

/**
 * Controller to handle the side menu.
 *
 * @module mm.core.sidemenu
 * @ngdoc controller
 * @name mmSideMenuCtrl
 */
.controller('mmSideMenuCtrl', function($scope, $state, $mmSideMenuDelegate, $mmSitesManager, $mmSite, $mmEvents,
            $timeout, mmCoreEventLanguageChanged, mmCoreEventSiteUpdated, $mmSideMenu, $mmUtil, $translate, $mmText, $ionicHistory, $mmLoginHelper) {

    $mmSideMenu.setScope($scope);
    $scope.handlers = $mmSideMenuDelegate.getNavHandlers();
    $scope.areNavHandlersLoaded = $mmSideMenuDelegate.areNavHandlersLoaded;
    $scope.siteinfo = $mmSite.getInfo();

     $mmSitesManager.getSites().then(function(sites) {
        // Remove protocol from the url to show more url text.
        sites = sites.map(function(a) {
            a.siteurl = a.siteurl.replace(/^https?:\/\//, '');
            return a;
        });

        // Sort sites by url and fullname.
        $scope.sites = sites.sort(function(a, b) {
            // First compare by site url without the protocol.
            var compareA = a.siteurl.toLowerCase(),
                compareB = b.siteurl.toLowerCase(),
                compare = compareA.localeCompare(compareB);

            if (compare !== 0) {
                return compare;
            }

            // If site url is the same, use fullname instead.
            compareA = a.fullname.toLowerCase().trim();
            compareB = b.fullname.toLowerCase().trim();
            return compareA.localeCompare(compareB);
        });

        $scope.data = {
            hasSites: sites.length > 0,
            showDelete: false
        };
    });

    $scope.logout = function() {
        $mmSitesManager.logout().finally(function() {
            $state.go('mm_login.sites');
        });
    };

    $mmSite.getDocsUrl().then(function(docsurl) {
        $scope.docsurl = docsurl;
    });

    function updateSiteInfo() {
        // We need to use $timeout to force a $digest and make $watch notice the variable change.
        $scope.siteinfo = undefined;
        $timeout(function() {
            $scope.siteinfo = $mmSite.getInfo();

            // Update docs URL, maybe the Moodle release has changed.
            $mmSite.getDocsUrl().then(function(docsurl) {
                $scope.docsurl = docsurl;
            });
        });
    }

    var langObserver = $mmEvents.on(mmCoreEventLanguageChanged, updateSiteInfo);
    var updateSiteObserver = $mmEvents.on(mmCoreEventSiteUpdated, function(siteid) {
        if ($mmSite.getId() === siteid) {
            updateSiteInfo();
        }
    });

    $scope.$on('$destroy', function() {
        if (langObserver && langObserver.off) {
            langObserver.off();
        }
        if (updateSiteObserver && updateSiteObserver.off) {
            updateSiteObserver.off();
        }
    });

    $scope.onItemDelete = function(e) {
        // Prevent login() from being triggered. No idea why I cannot replicate this
        // problem on http://codepen.io/ionic/pen/JsHjf.
        e.stopPropagation();

        var site = $scope.sites[0],
            sitename = site.sitename;

        $mmText.formatText(sitename).then(function(sitename) {
            $mmUtil.showConfirm($translate.instant('mm.login.confirmdeletesite', {sitename: sitename})).then(function() {
                $mmSitesManager.deleteSite(site.id).then(function() {
                    $scope.sites.splice(0, 1);
                    $scope.data.showDelete = false;
                    $mmSitesManager.hasNoSites().then(function() {
                        // No sites left, go to add a new site state.
                        $ionicHistory.nextViewOptions({disableBack: true});
                        $mmLoginHelper.goToAddSite();
                    });
                }, function() {
                    $log.error('Delete site failed');
                    $mmUtil.showErrorModal('mm.login.errordeletesite', true);
                });
            });
        });
    };

});