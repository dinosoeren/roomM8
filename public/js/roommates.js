var showRoommateResults = true;
var showingBackToTopBtn = false;
fireWhenJQueryReady(function() {
    $(document).ready(function() {
        // Make spinner follow browser scroll position when user scrolls past bottom of roomie search div.
        var backToTopBtn = $('#backToTop');
        var limitEle = $('#roomieSearchContainer');
        $(window).on('scroll', function() {
            var spinner = $('#roomiesContainer .spinner');
            // If user scrolled past bottom of search div.
            if($(window).scrollTop() >= limitEle.offset().top + limitEle.outerHeight()) {
                if(spinner.length > 0) {
                    if(spinner.css('position') !== 'fixed') {
                        spinner.css('position', 'fixed');
                        spinner.css('top', '50%');
                    }
                }
                if(!showingBackToTopBtn) {
                    backToTopBtn.hide().fadeIn(200);
                    showingBackToTopBtn = true;
                }
            } else {
                if(spinner.length > 0) {
                    if(spinner.css('position') !== 'absolute') {
                        spinner.css('position', 'absolute');
                        spinner.css('top', '50px');
                    }
                }
                if(showingBackToTopBtn) {
                    showingBackToTopBtn = false;
                    backToTopBtn.fadeOut(200);
                }
            }
        });
        backToTopBtn.on('click', function() {
            $('html, body').animate({
                scrollTop: limitEle.offset().top
            }, 1000);
        });
    });
});
// pad() from: http://stackoverflow.com/a/10073788/3673087
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
// Mod function from: http://stackoverflow.com/a/17323608/3673087
function mod(n, m) {
        return ((n % m) + m) % m;
}
// Check to see if the roomie's start date is within 1 month (+/-) of filter start date.
function startDateWithinAMonth(roomieDate, startDate) {
    var wiggleRoom = 1;
    var sdArr = startDate.split('-');
    var sdYear = parseInt(sdArr[0]);
    var sdMonth = parseInt(sdArr[1])-1; // 0-11
    var minYear = sdYear;
    var minMonth = mod((sdMonth - wiggleRoom), 12);
    var maxYear = sdYear;
    var maxMonth = mod((sdMonth + wiggleRoom), 12);
    if(minMonth > sdMonth) {
        // Month wrapped back around! assuming wiggleRoom <= 12, subtract 1 year.
        minYear--;
    }
    if(maxMonth < sdMonth) {
        // Month wrapped back around! assuming wiggleRoom <= 12, add 1 year.
        maxYear++;
    }
    var minDate = minYear+"-"+pad(minMonth+1, 2);
    var maxDate = maxYear+"-"+pad(maxMonth+1, 2);
    return roomieDate == startDate ||
            roomieDate == minDate ||
            roomieDate == maxDate;
}
function makeURLReady(location) {
    return location.replace(/\(.*\)/g, '').trim().replace(/\s+/g, '+');
}
// Generate link to Google Maps directions between start and end locations.
function genMapsLink(start, end) {
    return 'https://www.google.com/maps?saddr='+makeURLReady(start)+'&daddr='+makeURLReady(end);
}

/** ANGULAR STUFF **/
var app;
fireWhenAllReady(function() {
    app = angular.module('roommatesApp', ['infinite-scroll']);
    app.config(function($logProvider) {
        $logProvider.debugEnabled(false);
    });
    app.filter('dateFormat', function() {
        return formatDateNumToWords;
    });
    app.filter('residenceFilter', function() {
        return function(type, typeCustom="") {
            if(type === "idc")
                return "Anything";
            if(type === "other")
                return typeCustom.capitalize();
            return type.capitalize();
        };
    });
    app.filter('durationFilter', function() {
        return function(duration) {
            return duration == -1 ? "Any period" : duration + " months";
        };
    });
    app.filter('locationsFilter', function() {
        return function(locations) {
            if(typeof locations === "string")
                return [locations];
            return locations;
        };
    });
    app.filter('mapLinkFilter', function() {
        return function(end, start) {
            return genMapsLink('Google '+start, end);
        };
    });
    app.filter('genderAgeFilter', function() {
        return function(gender, showGender, genderCustom, age, showAge) {
            var genderAndAge = "";
            if(showGender || showAge) {
                genderAndAge = "(";
                if(showGender) {
                    if(gender === "other")
                        genderAndAge += genderCustom.capitalize();
                    else
                        genderAndAge += gender.capitalize();
                    if(showAge)
                        genderAndAge += ", ";
                }
                if(showAge)
                    genderAndAge += age + " y/o";
                genderAndAge += ")";
            }
            return genderAndAge;
        };
    });
    app.filter('aboutFilter', function() {
        return function(aboutMe) {
            // strip html
            return aboutMe;
        };
    });
    app.filter('aboutShortenFilter', function() {
        return function(aboutMe) {
            if(aboutMe.length > 100)
                aboutMe = aboutMe.substring(0,100) + "...";
            return aboutMe;
        };
    });
    app.filter('peopleFilter', function() {
        return function(number) {
            var word = "person";
            if(typeof number === "string" || typeof number === "number") {
                if(number > 1)
                    word = "people";
            } else {
                if(number[0] == number[1]) {
                    number = number[0];
                    if(number > 1)
                        word = "people";
                } else {
                    word = "people";
                    number = "("+number.join('-')+")";
                }
            }
            return "+"+number+" "+word;
        };
    });
    app.filter('factorsFilter', function() {
        return selectTopFactors;
    });
    app.filter('roleFilter', function() {
        return function(role, roleCustom) {
            return (role === "other" ? roleCustom : role).capitalizeAll();
        };
    });
    fireWhenBootstrapReady(function() {
        app.directive('toolTip', function () {
            return function (scope, element, attrs) {
                $(element).tooltip();
            };
        });
    });
    app.filter('resultsFilter', function() {
        return function(input, $scope, name, startDate, field, role, resType, status, gender, age) {
            var output = [];
            angular.forEach(input, (roomie) => {
                var name_cond = !name || roomie.name.match(new RegExp(name, 'i')) !== null;
                var date_cond = !startDate || startDateWithinAMonth(roomie.startDate, startDate);
                var field_cond = !field || roomie.field == field;
                var role_cond = !role || roomie.role == role;
                var resType_cond = !resType || 
                    (roomie.preferences && roomie.preferences.residenceType == resType) ||
                    (roomie.preferences && roomie.preferences.residenceType == "idc") ||
                    (roomie.currentResidence && roomie.currentResidence.residenceType == resType);
                var status_cond = !status || roomie.hasPlace == (status == "has-place");
                var status_cond = !status || roomie.hasPlace == (status == "has-place");
                var gender_cond = !gender || (roomie.showGender && roomie.gender == gender);
                var age_cond = !age || (roomie.showAge && Math.abs(roomie.age - age) <= 3);
                // Only add this to output if all conditions are met.
                if(name_cond && date_cond && field_cond && role_cond && 
                        resType_cond && status_cond && gender_cond && age_cond) {
                    output.push(roomie);
                }
            });
            if($scope.foundFirstBatch && output.length === 0) {
                $scope.noResultsToShow = true;
                if(input.length > 0)
                    $scope.find(true);
            } else {
                $scope.noResultsToShow = false;
            }
            return output;
        };
    });
    app.controller('roomiesCtrl', ['$scope', '$http', 
        function($scope, $http) {
            // Init variables.
            // Always include location on page load.
            $scope.includeLocation = true;
            $scope.userStartLocation = userStartLocation;
            $scope.searchStartDateString = startDateString;
            $scope.searchStartDate = new Date(($scope.searchStartDateString+'/01').replace('-','/'));
            $scope.locations = [];
            $scope.finding = false;
            $scope.foundFirstBatch = false;
            $scope.dbCount = 0;
            $scope.resultsLimit = 20;
            $scope.noMoreResults = false;
            $scope.noResultsToShow = false;
            $scope.resultsError = false;
            $scope.roomies = [];
            $scope.fields = [
                { value: "cloud", name: 'Google Cloud' },
                { value: "tech", name: "Engineering & Technology" },
                { value: "sales", name: "Sales, Service & Support" },
                { value: "marketing", name: "Marketing & Communications" },
                { value: "design", name: "Design" },
                { value: "business", name: "Business Strategy" },
                { value: "finance", name: "Finance" },
                { value: "legal", name: "Legal" },
                { value: "people", name: "People" },
                { value: "facilities", name: "Facilities" },
                { value: "other", name: "Other" }
            ];
            // Find roommates.
            $scope.find = function(nextPage=false) {
                if($scope.finding || $scope.noMoreResults)
                    return;
                if($scope.foundFirstBatch && nextPage)
                    $scope.dbCount += $scope.resultsLimit;
                $scope.finding = true;
                startSpinner();
                var query = {
                    searchToken: searchToken,
                    startLocation: $scope.includeLocation ? $scope.searchStartLocation : '',
                    skip: $scope.dbCount,
                    limit: $scope.resultsLimit
                };
                /* http post code adapted from: http://stackoverflow.com/a/23966224/3673087 */
                var xsrf = $.param({ query: query });
                $http({
                    method: 'POST',
                    url: '/api/search',
                    data: xsrf,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(
                    function (response) {
                        if(response.data.error) {
                            console.error("Error: "+response.data.error);
                            $scope.noMoreResults = true;
                            $scope.resultsError = true;
                        } else {
                            if($scope.dbCount == 0) {
                                $scope.roomies = response.data;
                            } else {
                                if(response.data.length === 0) {
                                    // console.log("No more results ("+$scope.roomies.length+")");
                                    $scope.noMoreResults = true;
                                } else {
                                    $scope.roomies.push.apply($scope.roomies, response.data);
                                }
                            }
                        }
                        $scope.finding = false;
                        stopSpinner();
                        if(!$scope.foundFirstBatch)
                            $scope.foundFirstBatch = true;
                    }
                );
            };
            // Load google office locations.
            $http.get('data/locations.json').then(function(response) {
                var googleLocations = [];
                var locs = response.data.locations;
                var count = 0;
                for(var i=0; i<locs.length; i++) {
                    var continent = locs[i].continent;
                    for(var j=0; j<locs[i].cities.length; j++) {
                        googleLocations.push({ 
                            continent: continent,
                            city: locs[i].cities[j],
                            value: count
                        });
                        count++;
                    }
                }
                $scope.locations = googleLocations;
                $scope.find();
            });
            $scope.userHasMessaged = function(recipientId) {
                return mailRecipients.includes(recipientId);
            };
            $scope.locationChangeHandler = function() {
                // Reset skip amount.
                $scope.dbCount = 0;
                $scope.noMoreResults = false;
                $scope.find();
            };
            $scope.updateDateString = function() {
                if(typeof $scope.searchStartDate !== "undefined") {
                    $scope.searchStartDateString = 
                        $scope.searchStartDate.getUTCFullYear() + '-' + 
                        pad($scope.searchStartDate.getUTCMonth()+1, 2);
                }
            };
            $scope.loadMoreResults = function() {
                if($scope.foundFirstBatch)
                    $scope.find(true);
            };
        }
    ]);
    angular.bootstrap($('#roommatesAppContainer')[0], ['roommatesApp']);
});