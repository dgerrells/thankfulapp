angular.module('ThankfulApp', ['ngAnimate', 'ngMaterial', 'ngStorage'])
    .constant('helperUtils', {
        anonAnimalsList: 'alligator, anteater, armadillo, auroch, axolotl, badger, bat, beaver, buffalo, camel, chameleon, cheetah, chipmunk, chinchilla, chupacabra, cormorant, coyote, crow, dingo, dinosaur, dolphin, duck, elephant, ferret, fox, frog, giraffe, gopher, grizzly, hedgehog, hippo, hyena, jackal, ibex, ifrit, iguana, koala, kraken, lemur, leopard, liger, llama, manatee, mink, monkey, moose, narwhal, nyan cat, orangutan, otter, panda, penguin, platypus, python, pumpkin, quagga, rabbit, raccoon, rhino, sheep, shrew, skunk, slow loris, squirrel, tiger, turtle, walrus, wolf, wolverine, wombat'.split(','),
        thankfulColorsList: ['#1abc9c','#2ecc71', '#2980b9', '#8e44ad', '#34495e', '#F9D627', '#e74c3c', '#7f8c8d', '#f39c12', '#774F38', '#8f575a'],
        updateWaves: function ($timeout) {
            $timeout(function(){
                Waves.attach('.ripple-light', ['waves-light']);
                Waves.attach('.ripple-card', ['waves-light']);
                Waves.attach('.ripple-dark');
                Waves.init();
            });
        },
        getRandomAuthor: function() {
            return this.anonAnimalsList[~~(Math.random()*this.anonAnimalsList.length)];
        },
        getThankfulColor: function(thankful) {
            Math.seedrandom(thankful.message);
            return this.thankfulColorsList[~~(Math.random()*this.thankfulColorsList.length)];
        }
    })
    .controller('MainCtrl', function($scope, $timeout, thankfulService, helperUtils) {
        var controller = this;
        controller.trending = false;
        controller.helperUtils = helperUtils;
        helperUtils.updateWaves($timeout);
    })
    .controller('HomeCtrl', function($scope, $timeout, $mdDialog, thankfulService, helperUtils) {
        var controller = this;
        controller.userThankfulList = thankfulService.getUserThankfulList();
        controller.addThankful = function() {
            if (this.thankfulMessage === '' || this.thankfulMessage.length > 120) {
                return;
            }
            thankfulService.createThankful(this.thankfulMessage);
            controller.thankfulMessage = '';
            document.activeElement.blur();
        };
        controller.deleteThankful = function(thankful, $event) {
            $mdDialog.show(
                $mdDialog.confirm()
                .title('Remove Thankful Card')
                .textContent('Are you sure you\'re no longer thankful for "'+ thankful.message +'" ?')
                .ok('Remove')
                .cancel('Keep')
                .targetEvent($event)
            ).then(function () {
                thankfulService.removeThankful(thankful);
            });
        };
        controller.getLocalData = function() {
            return thankfulService.localData;
        };

        $scope.$watch(function(scope) {
            return controller.userThankfulList;
        }, function(newVal, oldVal) {
            helperUtils.updateWaves($timeout);
        }, true);
    })
    .controller('TrendingCtrl', function($scope, $timeout, thankfulService, helperUtils) {
        var controller = this,
            recentLocalDataKey = 'recentList',
            trendingLocalDataKey = 'trendingList',
            filterTrendingMap = {
                'Trending today': 0,
                'Trending this week': 7,
                'Trending this month': 30
            },
            updateList = function() {
                controller.list.splice(0,controller.list.length);
                thankfulService.localData[controller.localDataFilterKey].forEach(function(item){
                    controller.list.push(item);
                });
            },
            onFilterChange = function(newVal, oldVal) {
                if (newVal === oldVal) {
                    return;
                }
                controller.localDataFilterKey = recentLocalDataKey;
                if (newVal === 'Recent') {
                    thankfulService.updateRecentThankfuls().then(updateList);
                } else {
                    thankfulService.updateTrendingThankfuls(moment().subtract(filterTrendingMap[newVal], 'day').format('YYYY-MM-DD')).then(updateList);
                    controller.localDataFilterKey = trendingLocalDataKey;
                }
            };
            var pollsUntilSleep = 12;
            controller.pollCount = 0;
            (function newThankfulPoll() {
                $timeout(function() {
                    if (controller.pollCount < pollsUntilSleep) {
                        thankfulService.updateRecentThankfuls().then(updateList);
                        controller.pollCount++;
                    }
                    newThankfulPoll();
                }, 15000);
            })();
        controller.list = [];
        controller.localDataFilterKey = recentLocalDataKey;
        controller.filter = 'Trending this week';
        controller.likedThankfuls = thankfulService.getLikedThankfuls();
        controller.likeThankful = function(thankful) {
            thankfulService.likeThankful(thankful);
        };
        controller.addToUserThankfuls = function(thankful) {
            thankfulService.addThankful(thankful);
        };
        controller.moveToHome = function(mCtrl) {
            controller.pollCount = 0;
            mCtrl.trending = !mCtrl.trending;
            thankfulService.resetNewThankfulsCount();
        };
        thankfulService.updateRecentThankfuls().then(updateList).then(function() {
            thankfulService.resetNewThankfulsCount();
        });
        onFilterChange('Trending this week', '');
        $scope.$watch( function (scope) {
            return controller.filter;
        }, onFilterChange);
    })
    .factory('thankfulService', function($localStorage, $http, $rootScope, helperUtils, $timeout) {
        // $localStorage.$reset();
        var apiUrl = 'https://thankful-app-api.herokuapp.com/api/grateful';
        var service = {};
        var thankfulSortPredicate = function(a, b) {
            if (a.created < b.created) {
                return 1;
            }
            if (a.created > b.created) {
                return -1;
            }
            return 0;
        };
        var getRecentRequestPromise = function() {
            return $http.get(apiUrl + '/recent')
                .then(function(response) {
                    response.data.forEach(function(thankful) {
                        if (!$localStorage.recentThankfulMap[thankful.id]) {
                            $localStorage.newThankfulsCount++;
                        }
                        $localStorage.recentThankfulMap[thankful.id] = thankful;
                    });
                    var recentThankfulList = [];
                    for (var key in $localStorage.recentThankfulMap) {
                        if ($localStorage.recentThankfulMap.hasOwnProperty(key)) {
                            recentThankfulList.push($localStorage.recentThankfulMap[key]);
                        }
                    }
                    helperUtils.updateWaves($timeout);
                    return recentThankfulList.sort(thankfulSortPredicate);
                }, function(response) {
                    console.log(response);
                    return 0;
                });
        };
        var getTrendingRequestPromise = function(dateQueryString) {
            return $http.get(apiUrl + '/trending/' + dateQueryString)
                .then(function(response) {
                    helperUtils.updateWaves($timeout);
                    return response.data;
                }, function(response) {
                    console.log(response);
                });
        };
        var getCreateThankfulRequestPromise = function(thankfulMessage, thankfulAuthor) {
            return $http.post(apiUrl + '/create', {
                    message: thankfulMessage,
                    author: thankfulAuthor
                })
                .then(function(response) {
                    return response.data;
                }, function(response) {
                    console.log(response);
                });
        }

        $localStorage.newThankfulsCount = 0;
        $localStorage.userThankfulList = $localStorage.userThankfulList || [
            {
                id: '57a266e6777367bd8be3c1a4',
                message: "Being alive!",
                author: "The Primogenitor",
                likes: 31,
                created:  "2016-08-03T21:49:02.216Z"
            }
        ];
        $localStorage.likedThankfulMap = $localStorage.likedThankfulMap || {};
        $localStorage.recentThankfulMap = $localStorage.recentThankfulMap || {};

        service.localData = {
            recentList: [],
            trendingList: [],
            newThankfuls: $localStorage.newThankfulsCount
        };
        service.guid = function() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
        service.createThankful = function(thankfulMessage) {
            var guid = service.guid();
            service.addThankful({
                message: thankfulMessage,
                author: 'anonymous ' + helperUtils.getRandomAuthor(),
                likes: 0,
                created: moment().format(),
                id: guid
            });
            getCreateThankfulRequestPromise(thankfulMessage, 'anonymous ' + helperUtils.getRandomAuthor())
                .then(function(responseData) {
                    if (responseData) {
                        $localStorage.recentThankfulMap[responseData.record.id] = responseData.record;
                        $localStorage.userThankfulList.forEach(function(record) {
                            if (record.id === guid) {
                                record.id = responseData.record.id;
                            }
                        });
                    }
                });
        };
        service.addThankful = function(thankful) {
            if ($localStorage.userThankfulList.filter(function(item) {
                    return item.id === thankful.id;
                }).length > 0) {
                return;
            }
            $localStorage.userThankfulList.push({
                message: thankful.message,
                author: thankful.author,
                id: thankful.id,
                likes: thankful.likes,
                created: moment().format()
            });
            $localStorage.userThankfulList.sort(thankfulSortPredicate);
        };
        service.removeThankful = function(thankful) {
            var index = $localStorage.userThankfulList.indexOf(thankful);
            if (index != -1) {
                $localStorage.userThankfulList.splice(index, 1);
            }
        };
        service.likeThankful = function(thankful) {
            if (!$localStorage.likedThankfulMap[thankful.id]) {
                $http.put(apiUrl + '/like/' + thankful.id).then(function(response) {
                    $localStorage.likedThankfulMap[thankful.id] = true;
                    thankful.likes++;
                });
            }
        };
        service.getLikedThankfuls = function() {
            return $localStorage.likedThankfulMap;
        };
        service.getUserThankfulList = function() {
            return $localStorage.userThankfulList.sort(thankfulSortPredicate);
        };
        service.updateRecentThankfuls = function() {
            return getRecentRequestPromise().then(function (data) {
                service.localData.recentList = data || [];
                service.localData.newThankfuls = $localStorage.newThankfulsCount;
            });
        };
        service.updateTrendingThankfuls = function(dateQueryString) {
            return getTrendingRequestPromise(dateQueryString).then(function (data) {
                service.localData.trendingList = data || [];
            });
        };
        service.resetNewThankfulsCount = function() {
            $localStorage.newThankfulsCount = 0;
            service.localData.newThankfuls = $localStorage.newThankfulsCount;
        };
        return service;
    })
    .config(function($mdThemingProvider, $mdColorPalette) {
        $mdThemingProvider.definePalette('mcgpalette1', {
            '50': '#f0eef0',
            '100': '#cdc5cb',
            '200': '#b3a6af',
            '300': '#92808d',
            '400': '#84707e',
            '500': '#73626e',
            '600': '#62545e',
            '700': '#52464e',
            '800': '#41383f',
            '900': '#312a2f',
            'A100': '#f0eef0',
            'A200': '#cdc5cb',
            'A400': '#84707e',
            'A700': '#52464e',
            'contrastDefaultColor': 'light',
            'contrastDarkColors': '50 100 200 300 A100 A200'
        });
        $mdThemingProvider.theme('t1').primaryPalette('mcgpalette1');
        $mdThemingProvider.theme('t9').primaryPalette('blue-grey');
        $mdThemingProvider.setDefaultTheme('t1');
        // $mdThemingProvider.alwaysWatchTheme(true);
    });
!function(a,b,c,d,e,f,g,h,i){function j(a){var b,c=a.length,e=this,f=0,g=e.i=e.j=0,h=e.S=[];for(c||(a=[c++]);d>f;)h[f]=f++;for(f=0;d>f;f++)h[f]=h[g=s&g+a[f%c]+(b=h[f])],h[g]=b;(e.g=function(a){for(var b,c=0,f=e.i,g=e.j,h=e.S;a--;)b=h[f=s&f+1],c=c*d+h[s&(h[f]=h[g=s&g+b])+(h[g]=b)];return e.i=f,e.j=g,c})(d)}function k(a,b){var c,d=[],e=typeof a;if(b&&"object"==e)for(c in a)try{d.push(k(a[c],b-1))}catch(f){}return d.length?d:"string"==e?a:a+"\0"}function l(a,b){for(var c,d=a+"",e=0;e<d.length;)b[s&e]=s&(c^=19*b[s&e])+d.charCodeAt(e++);return n(b)}function m(c){try{return o?n(o.randomBytes(d)):(a.crypto.getRandomValues(c=new Uint8Array(d)),n(c))}catch(e){return[+new Date,a,(c=a.navigator)&&c.plugins,a.screen,n(b)]}}function n(a){return String.fromCharCode.apply(0,a)}var o,p=c.pow(d,e),q=c.pow(2,f),r=2*q,s=d-1,t=c["seed"+i]=function(a,f,g){var h=[];f=1==f?{entropy:!0}:f||{};var o=l(k(f.entropy?[a,n(b)]:null==a?m():a,3),h),s=new j(h);return l(n(s.S),b),(f.pass||g||function(a,b,d){return d?(c[i]=a,b):a})(function(){for(var a=s.g(e),b=p,c=0;q>a;)a=(a+c)*d,b*=d,c=s.g(1);for(;a>=r;)a/=2,b/=2,c>>>=1;return(a+c)/b},o,"global"in f?f.global:this==c)};if(l(c[i](),b),g&&g.exports){g.exports=t;try{o=require("crypto")}catch(u){}}else h&&h.amd&&h(function(){return t})}(this,[],Math,256,6,52,"object"==typeof module&&module,"function"==typeof define&&define,"random");
