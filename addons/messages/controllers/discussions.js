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

angular.module('mm.addons.messages')

/**
 * Discussions controller.
 *
 * @module mm.addons.messages
 * @ngdoc controller
 * @name mmaMessagesDiscussionsCtrl
 */
.controller('mmaMessagesDiscussionsCtrl', function($scope, $mmUtil, $mmaMessages, $rootScope, $mmEvents, $mmSite, $ionicPlatform,
            mmCoreSplitViewLoad, mmaMessagesNewMessageEvent, $mmAddonManager) {
    var newMessagesObserver,
        siteId = $mmSite.getId(),
        discussions,
        $mmPushNotificationsDelegate = $mmAddonManager.get('$mmPushNotificationsDelegate'),
        unregisterResume;

    $scope.loaded = false;

    function fetchDiscussions() {
        return $mmaMessages.getDiscussions().then(function(discs) {
            discussions = discs;

            // Convert to an array for sorting.
            var array = [];
            angular.forEach(discussions, function(v) {
                array.push(v);
            });
            $scope.discussions = array;
        }, function(error) {
            if (typeof error === 'string') {
                $mmUtil.showErrorModal(error);
            } else {
                $mmUtil.showErrorModal('mma.messages.errorwhileretrievingdiscussions', true);
            }
        }).finally(function() {
            $scope.loaded = true;
        });
    }

    function refreshData() {
        return $mmaMessages.invalidateDiscussionsCache().then(function() {
            return fetchDiscussions();
        });
    }

    $scope.refresh = function() {
        refreshData().finally(function() {
            $scope.$broadcast('scroll.refreshComplete');
        });
    };

    fetchDiscussions().finally(function() {
        // Tell mm-split-view that it can load the first link now in tablets. We need to do it
        // like this because the directive doesn't have access to $scope.loaded variable (because of tabs).
        $rootScope.$broadcast(mmCoreSplitViewLoad);
    });

    newMessagesObserver = $mmEvents.on(mmaMessagesNewMessageEvent, function(data) {
        var discussion;

        if (data && data.siteid == siteId && data.userid) {
            discussion = discussions[data.userid];

            if (typeof discussion == 'undefined') {
                // It's a new discussion. Refresh list.
                $scope.loaded = false;
                refreshData().finally(function() {
                    $scope.loaded = true;
                });
            } else {
                // An existing discussion has a new message, update the last message.
                discussion.message.message = data.message;
                discussion.message.timecreated = data.timecreated;
            }
        }
    });

    // If a message push notification is received, refresh the view.
    if ($mmPushNotificationsDelegate) {
        $mmPushNotificationsDelegate.registerReceiveHandler('mmaMessages:discussions', function(notification) {
            if ($mmUtil.isFalseOrZero(notification.notif)) {
                // New message received. If it's from current site, refresh the data.
                if (notification.site == $mmSite.getId()) {
                    $scope.loaded = false;
                    refreshData();
                }
            }
        });
    }

    // Refresh the view when the app is resumed.
    unregisterResume = $ionicPlatform.on('resume', function() {
        $scope.loaded = false;
        refreshData();
    });

    $scope.$on('$destroy', function() {
        if (newMessagesObserver && newMessagesObserver.off) {
            newMessagesObserver.off();
        }
        if ($mmPushNotificationsDelegate) {
            $mmPushNotificationsDelegate.unregisterReceiveHandler('mmaMessages:discussions');
        }
        if (unregisterResume) {
            unregisterResume();
        }
    });
});
