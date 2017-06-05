var currentStep = 0;
var lastStep = 0;
var isHash = window.location.hash === "#success";
var tagsInputInitialized = false;
var isModalReady = true;
var hasSecretKeyInputChanged = false;
var invalidFieldErrorMessage = "";
const REG_STEP_DELETE = -1; // currentStep value for delete confirmation fieldset
const REG_STEP_NO_PLACE = 3; // fieldset ID in registration form for users with no place
const REG_STEP_HAS_PLACE = 4; // fieldset ID in registration form for users with a place

$(document).ready(function(){
    lastStep = $('#registration-form fieldset:not(#confirmDelete)').length-1;

    // Reset form errors when modal is opened.
    $('#registerModal').on('shown.bs.modal', function() {
        hideErrorMessage();
        hideSuccessMessage();
        if(currentStep !== REG_STEP_DELETE)
            $('#registration-form .modal-header').removeClass('bg-danger');
    });
    // Show modal on page load if '#success' is in url.
    if(isHash) {
        $('#registerModal').modal("show");
    }
    // Initialize 'important factors' sliders.
    if($(".factors .slider").length > 0) {
        $(".factors .slider").slider({
            ticks: [1,2,3],
            tooltip: 'hide'
        });
    }
    if($("#numRoommatesRange").length > 0) {
        $("#numRoommatesRange").slider({
            ticks: [1,2,3,4,5,6],
            ticks_labels: ["1","2","3","4","5","6"],
            range: "true",
            formatter: function(slider_val) {
                var v = (slider_val + "").split(',');
                var min = v[0];
                var max = v[1];
                var range = min+"-"+max;
                var word = "people";
                if(min === max) {
                    range = min;
                    if(min == 1)
                        word = "person";
                }
                return range+" "+word;
            }
        });
    }

    // Init registration form stuff.
    $('[data-toggle="tooltip"]').tooltip();
    $('.error-message').hide();
    $('.success-message').hide();
    $('#registration-form .btn-register').hide();
    $('#registration-form .btn-previous').hide();
    $('#registration-form fieldset#f0').fadeIn('slow');
    $('#registration-form .btn-register').on('click', function() {
        if(!areAllFieldInputsValid()) {
            showErrorMessage();
            return;
        }
        $('#registration-form').submit();
    });
    $('.regRequired,.form-control').on('focus', function () {
        $(this).removeClass('input-error');
    });
    if($("#editText").length > 0)
        $("#continueText").hide();
    // Handle "other" selection.
    $(".other-enabled").each(function() {
        var selectorDiv = $(this).children('div:first-child');
        var otherInputDiv = $(this).children('div:nth-child(2)');
        var selector = selectorDiv.find('select');
        var otherInput = otherInputDiv.find('input');
        selector.on('change', function() {
            if(selector.val() === "other") {
                selectorDiv.removeClass('col-sm-12');
                selectorDiv.addClass('col-sm-6');
                otherInputDiv.show();
                otherInput.removeClass('optional');
                otherInput.focus();
            } else {
                selectorDiv.addClass('col-sm-12');
                selectorDiv.removeClass('col-sm-6');
                otherInputDiv.hide();
                otherInput.addClass('optional');
                otherInput.val('');
            }
        });
    });
    // Handle big radio input for hasPlace.
    $(".hasPlaceRadioField").each(function() {
        var fieldsetContainer = $(this);
        var glyph = fieldsetContainer.find('span.glyphicon');
        $(this).find('input').on('change', function() {
            if($(this).val() === "no") {
                fieldsetContainer.find('label.no').addClass('checked');
                fieldsetContainer.find('label.yes').removeClass('checked');
                glyph.removeClass('glyphicon-home');
                glyph.addClass('glyphicon-search');
            } else {
                fieldsetContainer.find('label.no').removeClass('checked');
                fieldsetContainer.find('label.yes').addClass('checked');
                glyph.addClass('glyphicon-home');
                glyph.removeClass('glyphicon-search');
            }
        });
    });
    // Handle 'Cancel' button click.
    $("#registration-form .btn-cancel").on('click', function() {
        if(!isModalReady)
            return;
        isModalReady = false;
        var parent_fieldset;
        if(currentStep === REG_STEP_DELETE) {
            $('#agreeToDelete').prop('checked', false); // Uncheck agree box.
            parent_fieldset = $('#registration-form fieldset#confirmDelete');
        } else {
            parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        }
        currentStep = 0; // Go back to step 0 after this.
        parent_fieldset.fadeOut(200, function () {
            $('#registration-form fieldset#f'+currentStep).show();
            $('#registration-form')[0].reset(); // Reset the form to default values.
            $('#registration-form .regRequired, #registration-form .form-control').each(function () {
                $(this).removeClass('input-error'); // Remove input error classes.
            });
            $('#registration-form .modal-header').removeClass('bg-danger');
            evalFormStatus();
            isModalReady = true;
        });
    });
    // Handle 'Delete Profile' button click.
    $("#registration-form .btn-delete").on('click', function() {
        if(!isModalReady)
            return;
        isModalReady = false;
        if(currentStep == REG_STEP_DELETE) { 
            // Already in confirmation dialog.
            // Make sure the user checks the agree box.
            if(!$("#agreeToDelete").is(":checked")) {
                $("#agreeToDelete").addClass('input-error');
                showErrorMessage("Please indicate that you understand the consequences.");
                isModalReady = true;
                return;
            }
            $("#agreeToDelete").removeClass('input-error');
            // Delete user profile!
            console.log("Deleting user profile!");
            $('#registration-form').attr('action', "/deleteMe").submit();
            isModalReady = true;
            return;
        }
        // Go to confirmation dialog.
        var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        currentStep = REG_STEP_DELETE;
        parent_fieldset.fadeOut(200, function () {
            $('#registration-form .modal-header').addClass('bg-danger');
            $('#registration-form fieldset#confirmDelete').fadeIn(200, function() {
                isModalReady = true;
            });
            evalFormStatus();
        });
    });
    // Handle 'Next/Edit' button click.
    $('#registration-form .btn-next').on('click', function () {
        if(!isModalReady)
            return;
        if(currentStep >= lastStep)
            return;
        isModalReady = false;
        // Load city data if it hasn't been loaded.
        readAndInitCityTags(function() {
            var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
            if (areAllFieldInputsValid()) {
                // If at step before step for NO_PLACE.
                if(currentStep === REG_STEP_NO_PLACE - 1) {
                    if(userHasPlace()) {
                        // Skip step for NO_PLACE if the user has a place already.
                        currentStep++;
                        // Also hide irrelevant factors in 'importance' fieldset.
                        $(".no-place").hide();
                    } else {
                        // Otherwise, show all factors in 'importance' fieldset.
                        $(".no-place").show();
                    }
                // Else if at step for NO_PLACE.
                } else if(currentStep == REG_STEP_NO_PLACE) {
                    // Skip step for HAS_PLACE if the user does not have a place.
                    currentStep++;
                }
                currentStep++;
                parent_fieldset.fadeOut(200, function () {
                    hideErrorMessage();
                    hideSuccessMessage();
                    $('#registration-form fieldset#f'+currentStep).fadeIn(200, function() {
                        isModalReady = true;
                        // Refresh bootstrap sliders in modal so labels/ticks appear correctly formatted.
                        // Only refresh them once, though, so that the user's input does not get overridden.
                        $(this).find("input.slider").each(function() {
                            if($(this).attr('refreshed') !== "true") {
                                $(this).slider('refresh');
                                $(this).attr('refreshed', 'true');
                            }
                        });
                    });
                    evalFormStatus();
                });
            } else {
                showErrorMessage();
                isModalReady = true;
            }
        });
    });
    // Handle 'Back' button click.
    $('#registration-form .btn-previous').on('click', function () {
        if(!isModalReady)
            return;
        if(currentStep == 0)
            return;
        isModalReady = false;
        var parent_fieldset;
        if(currentStep === REG_STEP_DELETE) {
            $('#agreeToDelete').prop('checked', false); // uncheck agree box
            parent_fieldset = $('#registration-form fieldset#confirmDelete');
            currentStep = 1; // go back to step 0 after this.
        } else {
            parent_fieldset = $('#registration-form fieldset#f'+currentStep);
        }
        $(parent_fieldset).fadeOut(200, function () {
            hideErrorMessage();
            hideSuccessMessage();
            $('#registration-form .modal-header').removeClass('bg-danger');
            if(currentStep === REG_STEP_HAS_PLACE || (currentStep === REG_STEP_HAS_PLACE+1 && !userHasPlace())) {
                // Go back to step before NO_PLACE from step HAS_PLACE if the user already has a place.
                // Go back to step NO_PLACE from step after HAS_PLACE if the user does not have a place.
                currentStep--;
            }
            currentStep--;
            $('#registration-form fieldset#f'+currentStep).fadeIn(200, function() {
                isModalReady = true;
            });
            evalFormStatus();
        });
    });

    // Handle secret code events.
    $('#btn-check-code').on('click', function() {
        checkSecretKey();
    });
    $('#secretKey').on('change keypress', function(e) {
        if (e.which == 13) { // 'Enter' key.
            checkSecretKey();
            return false;
        } else {
            hasSecretKeyInputChanged = true;
        }
    });

    // Handle roommate search box events.
    $('#roommateSearchBox').on('focus', function() {
        $(this).parent('.input-group').addClass('focus');
    });
    $('#roommateSearchBox').on('blur', function() {
        $(this).parent('.input-group').removeClass('focus');
    });

    // Handle message form stuff.
    // Change title and input when message modal is opened.
    $('#messageModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget);
        var recipientName = button.data('name');
        var recipientID = button.data('id');
        var modal = $(this);
        // Hide messages.
        hideSuccessMessage('#message-form');
        hideErrorMessage('#message-form');
        // Show fieldset.
        $('#fieldsetMessage').show();
        $('#message-form .btn-send').show();
        $('#message-form .btn-cancel').text("Cancel");
        // Set title.
        modal.find('.modal-title').text('New message to ' + recipientName);
        // Reset inputs if this is a different user.
        if($('#messageSubject').val() === "" || $('#recipientID').val() != recipientID) {
            $('#messageSubject').val($('#messageSubject').data('default'));
            $('#messageContent').val('');
            $('#fieldsetMessage .regRequired, #fieldsetMessage .form-control').each(function () {
                $(this).removeClass('input-error'); // Remove input error classes.
            });
        }
        $('#recipientID').val(recipientID);
        $('#recipientName').val(recipientName);
        $('.recipientName').text(recipientName);
        // Uncheck checkboxes.
        modal.find("[type='checkbox']").prop('checked', false);
    });
    // Handle message send button click.
    var sendingMessage = false;
    $('#message-form .btn-send').on('click', function() {
        if(sendingMessage)
            return;
        if(!areAllFieldInputsValid('#fieldsetMessage')) {
            showErrorMessage(null, '#message-form');
            return;
        }
        sendingMessage = true;
        $('#fieldsetMessage').slideUp(200);
        startSpinner("#messageModal .modal-body");
        // Send message to server.
        $.post("/message", {
            recipientID: $("#recipientID").val(),
            subject: $('#messageSubject').val(),
            message: $('#messageContent').val()
        }).done(function(data) {
            stopSpinner();
            sendingMessage = false;
            if (data.error) {
                showErrorMessage("Error: "+data.error, '#message-form');
                $('#fieldsetMessage').stop().slideDown(200);
            } else {
                showSuccessMessage("Message sent successfully!", '#message-form', true);
                // Reset the form to default state.
                $('#message-form')[0].reset();
                $('#message-form .btn-send').hide();
                $('#message-form .btn-cancel').text("Done");
                // Disable the message button in profile card.
                var button = $(".profile-card button[data-id='"+$("#recipientID").val()+"']").first();
                button.prop('disabled', true);
                var glyphicon = button.find('.glyphicon');
                glyphicon.removeClass('glyphicon-send');
                glyphicon.addClass('glyphicon-ok');
                button.find('.btn-text').text("Message Sent");
            }
        }).fail(function() {
            stopSpinner();
            sendingMessage = false;
            showErrorMessage("An unexpected error occurred. Please try again.", '#message-form');
            $('#fieldsetMessage').stop().slideDown(200);
        });
    });

    // Handle Importance factors modal opening.
    $('#factorsModal').on('show.bs.modal', function(event) {
        var buttonPressed = $(event.relatedTarget);
        var roomieName = buttonPressed.data('name');
        var roomieFactors = buttonPressed.data('factors');
        var roomieHasPlace = buttonPressed.data('has-place');
        var modal = $(this);
        var check = '&#10004;';
        modal.find('.modal-title').text(roomieName+"'s importance ratings");
        // Show/hide factors depending on whether or not roomie has a place.
        if(roomieHasPlace) {
            $('#factorsModal .no-place').hide();
            $('#factorsModal .factorsTable').addClass('oddColor');
        } else {
            $('#factorsModal .no-place').show();
            $('#factorsModal .factorsTable').removeClass('oddColor');
        }
        // Set factors table according to roomie factors.
        for(var f=0; f<roomieFactors.length; f++) {
            var factor = roomieFactors[f].factor;
            var factorRow = $('#factorsModal #fac-'+factor+' > div:nth-child(2)');
            var rating = roomieFactors[f].rating;
            for(var i=1; i<=3; i++) {
                var ratingCell = factorRow.children('div:nth-child('+i+')');
                if(i === rating)
                    ratingCell.html(check);
                else
                    ratingCell.html('');
            }
        }
    });

    // Handle advanced search stuff.
    $("#advanced-search .filter-group").each(function() {
        var inputField = $(this).find('.form-control').first();
        var checkboxLabel = $(this).find(".input-group-addon").first();
        var checkbox = $(this).find("input[type='checkbox']").first();
        checkbox.change(function() {
            if($(this).is(":checked")) {
                inputField.attr('readonly', false);
            } else {
                inputField.attr('readonly', true);
            }
        });
        inputField.on('focus click mousedown', function(e) {
            if(inputField.is('[readonly]')) {
                e.stopPropagation();
                e.preventDefault();
                this.blur();
                window.focus();
                checkboxLabel.stop().addClass("flash").delay(500).queue(function() {
                    checkboxLabel.removeClass("flash").dequeue();
                });
                return false;
            }
        });
    });

    $("#toggleVisibilityBtn").on('click', function() {
        $("#toggleVisibilityForm").submit();
    });

    $("#registerModal .profile-card .desc").each(function() {
        shortenAboutMe(this);
    });
    $("#dateToFormat").each(function() {
        $(this).text(formatDateNumToWords($(this).text()));
    });
    $("#factorsToSort").each(function() {
        $(this).text(selectTopFactors($(this).data('factors')));
    });
});

// Capitalize words.
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
String.prototype.capitalizeAll = function() {
    var words = this.split(' ');
    for(var i=0; i<words.length; i++) {
        words[i] = words[i].capitalize();
    }
    return words.join(' ');
};
// Shorten 'about me' text and potentially hide 'More' link.
function shortenAboutMe(desc_container) {
    var aboutText = $(desc_container).attr('data-desc');
    if(aboutText.length > 100) {
        aboutText = aboutText.substring(0,100)+"...";
    } else {
        $(desc_container).find('.more').hide();
    }
    $(desc_container).find('span').text(aboutText);
}
// Handle profile card description 'Read more' click event.
function toggleReadMore(event, ele) {
    var descContainer = $(ele).parent('.desc');
    if($(ele).is('.more')) {
        $(ele).removeClass("more");
        $(ele).text("Less");
        descContainer.find('span').text(descContainer.attr('data-desc'));
    } else {
        $(ele).addClass("more");
        $(ele).text("More");
        shortenAboutMe(descContainer);
    }
    event.preventDefault();
}
// Format date. Convert from '2017-09' to 'September 2017'
function formatDateNumToWords(dateString) {
    var options = {
        year: "numeric", month: "long"
    };
    return new Date(dateString+"-02").toLocaleDateString("en-US", options);
};
var factorsDict = {
    location: "Location",
    residenceType: "Residence type",
    ownBedroom: "Own bedroom",
    ownBathroom: "Own bathroom",
    commuteTime: "Short commute time",
    cleanliness: "Cleanliness",
    quietTime: "Quiet time",
    substanceFree: "Substance-free",
    sameGender: "Same gender",
    sameAge: "Same age",
    sameField: "Same field"
};
// Get the top 3 most important factors from array.
function selectTopFactors(factors) {
    var mostImportant = [];
    for(var i=0; i<3; i++) {
        mostImportant.push(factorsDict[factors[i].factor]);
    }
    return mostImportant.join(", ");
};

function readAndInitCityTags(cb) {
    if(tagsInputInitialized || $('#pref-locations').length === 0)
        return cb();
    startSpinner("#registerModal .modal-body");
    // Read cities json file and initialize cities input.
    $.getJSON('data/citynames.json', function(data) {
        var count = 0;
        async.map(data, function(cityname, callback) {
            count++;
            var newObj = { name: cityname };
            if(count % 100 == 0) {
                setTimeout(function() {
                    callback(null, newObj);
                }, 100);
            } else {
                callback(null, newObj);
            }
        }, function(err, results) {
            if(err)
                return console.log("Failed to fetch city data.");
            // Results is now an array of objects.
            initializeCityTagsInput(results, cb);
        });
    });
}
function initializeCityTagsInput(data, cb) {
    // Get typeahead data for Locations input.
    var citynames = new Bloodhound({
        local: data,
        datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        sufficient: 10
    });
    var promise = citynames.initialize();
    promise.done(function() {
        // Initialize Locations input.
        $('#pref-locations').tagsinput({
            maxTags: 10,
            maxChars: 20,
            trimValue: true,
            tagClass: 'label label-success',
            confirmKeys: [13, 44],
            typeaheadjs: {
                name: 'citynames',
                displayKey: 'name',
                valueKey: 'name',
                source: citynames.ttAdapter()
            },
            freeInput: true
        });
        $('.bootstrap-tagsinput input').on('focus', function () {
            $('.bootstrap-tagsinput').removeClass('input-error');
        });
        tagsInputInitialized = true;
        stopSpinner();
        cb();
    });
    promise.fail(function() {
        tagsInputInitialized = true;
        stopSpinner();
        cb();
    });
}

function areAllFieldInputsValid(fieldsetSelector) {
    var parent_fieldset = $('#registration-form fieldset#f'+currentStep);
    if (fieldsetSelector) {
        parent_fieldset = $(fieldsetSelector);
    }
    var allValid = true;
    $(parent_fieldset).find('.regRequired,.form-control').each(function () {
        // Don't check optional fields that are blank.
        if($(this).is('.optional') && $(this).val() === "")
            return;
        var tagsInput = $(this).prev('.bootstrap-tagsinput');
        if (!isFieldValid(this)) {
            invalidFieldErrorMessage = "";
            if($(this).is("[type='date']") && $(this).val() !== "")
                invalidFieldErrorMessage = " Date format: YYYY-MM-DD";
            if($(this).is("[type='month']") && $(this).val() !== "")
                invalidFieldErrorMessage = " Start date format: YYYY-MM";
            if(tagsInput.length > 0)
                tagsInput.addClass('input-error');
            else
                $(this).addClass('input-error');
            allValid = false;
        } else {
            if(tagsInput.length > 0)
                tagsInput.removeClass('input-error');
            else
                $(this).removeClass('input-error');
        }
    });
    return allValid;
}
// Check if a particular input field has a valid value.
function isFieldValid(ele) {
    var supportsValidate = typeof ele.willValidate !== "undefined";
    if($(ele).is("[type='checkbox']")) {
        return $(ele).is(":checked");
    }
    if($(ele).is("[type='date']")) {
        var dateComps = $(ele).val().split('-');
        if(dateComps.length !== 3)
            return false;
        if(dateComps[0].length !== 4 || 
                dateComps[1].length !== 2 || 
                dateComps[2].length !== 2)
            return false;
        var yearComp = parseInt(dateComps[0]);
        var monthComp = parseInt(dateComps[1]);
        var dateComp = parseInt(dateComps[2]);
        if(isNaN(yearComp) || isNaN(monthComp) || isNaN(dateComp))
            return false;
        if(yearComp < 1900 || monthComp < 1 || monthComp > 12 || 
                dateComp < 1 || dateComp > 31)
            return false;
    }
    if($(ele).is("[type='month']")) {
        var dateComps = $(ele).val().split('-');
        if(dateComps.length !== 2)
            return false;
        if(dateComps[0].length !== 4 || 
                dateComps[1].length !== 2)
            return false;
        var yearComp = parseInt(dateComps[0]);
        var monthComp = parseInt(dateComps[1]);
        if(isNaN(yearComp) || isNaN(monthComp))
            return false;
        if(yearComp < 1900 || monthComp < 1 || monthComp > 12)
            return false;
    }
    if($(ele).is("[type='number']")) {
        console.log(ele);
        if(isNaN(parseInt($(ele).val())))
            return false;
    }
    var value = $(ele).val();
    // Make sure it's stripped of html.
    var stripped = $('<p>'+value+'</p>').text();
    return value !== "" && value !== null && value.length !== 0 && value == stripped &&
            (!supportsValidate || !ele.willValidate || ele.checkValidity());
}
// Check if user has indicated they own a place.
function userHasPlace() {
    return $("#has-place").length > 0 && $("#has-place").is(':checked');
}
// Change form layout/style (like hiding/showing previous and 
// next buttons) based on current step.
function evalFormStatus() {
    // First, update modal title text.
    var fieldset = $('#registration-form fieldset#f'+currentStep);
    if(currentStep === REG_STEP_DELETE)
        fieldset = $('#registration-form fieldset#confirmDelete');
    $('#registration-form .modal-title').text(fieldset.data('title'));
    // Now, update progress bar.
    if(currentStep === 0 || currentStep === REG_STEP_DELETE) {
        $("#registerProgress").hide();
    } else {
        $("#registerProgress").show();
        var curr = currentStep;
        var curr = curr <= REG_STEP_NO_PLACE ? curr : curr-1;
        var max = (lastStep-1);
        var percent = ((curr/max)*100);
        $("#registerProgress .progress-bar").css("width", percent+"%");
        $("#registerProgress .percent").text(Math.round(percent)+"% Complete");
        $("#registerProgress .progress-bar").attr('aria-valuenow', percent);
    }
    // Finally, update buttons in modal footer.
    if(currentStep === REG_STEP_DELETE) {
        // Delete button was pressed. Take user to confirmation dialog.
        $('#registration-form .btn-next').hide();
        $('#registration-form .btn-previous').show();
        return;
    }
    if(currentStep === 0) {
        $('#registration-form .btn-previous').hide();
        if($("#editText").length > 0) {
            $("#registration-form .btn-delete").show();
            $("#editText").show();
            $("#continueText").hide();
        }
    } else {
        $('#registration-form .btn-previous').show();
        if($("#editText").length > 0) {
            $("#registration-form .btn-delete").hide();
            $("#editText").hide();
            $("#continueText").show();
        }
    }
    if(currentStep >= lastStep) {
        $('#registration-form .btn-next').hide();
        $('#registration-form .btn-register').show();
    } else {
        $('#registration-form .btn-register').hide();
        $('#registration-form .btn-next').show();
    }
}
// Show an error message in the form.
function showErrorMessage(msg, formSelector, persistent=false) {
    if(!formSelector)
        formSelector = "#registerModal";
    if(msg) {
        $(formSelector+' .error-message .msg').text(msg + invalidFieldErrorMessage);
    } else {
        $(formSelector+' .error-message .msg').text(
            $(formSelector+' .error-message').attr("data-message") 
            + invalidFieldErrorMessage
        );
    }
    $(formSelector+' .error-message').stop().slideDown(200);
    if(!persistent)
        $(formSelector+' .error-message').delay(3000).slideUp(200);
}
// Hide error message immediately.
function hideErrorMessage(formSelector) {
    if(!formSelector)
        formSelector = "#registerModal";
    $(formSelector+' .error-message').stop().hide();
}
// Show a success message in the form.
function showSuccessMessage(msg, formSelector, persistent=false) {
    if(!formSelector)
        formSelector = "#registerModal";
    if(msg) {
        $(formSelector+' .success-message .msg').text(msg);
    } else {
        $(formSelector+' .success-message .msg').text(
            $(formSelector+' .success-message').attr("data-message")
        );
    }
    $(formSelector+' .success-message').stop().slideDown(200);
    if(!persistent)
        $(formSelector+' .success-message').delay(3000).slideUp(200);
}
// Hide success message immediately.
function hideSuccessMessage(formSelector) {
    if(!formSelector)
        formSelector = "#registerModal";
    $(formSelector+' .success-message').stop().hide();
}

// Check if the secret code the user entered is valid.
function checkSecretKey() {
    if(!hasSecretKeyInputChanged)
        return;
    if($("#secretKey").val() === "")
        return;
    hasSecretKeyInputChanged = false;
    $.post("/access", {
        key: $("#secretKey").val()
    }).done(function(data) {
        if (data.error) {
            showErrorMessage("Error: "+data.error);
        } else {
            showSuccessMessage("Success! You entered the correct code.");
            $("#code-stuff").slideUp();
            $(".initial-signup .step2").text("Please sign in to continue");
        }
    }).fail(function() {
        showErrorMessage("An unexpected error occurred. Please try again.");
    });
}

// Build loading spinner!
var opts = {
  lines: 11 // The number of lines to draw
, length: 9 // The length of each line
, width: 10 // The line thickness
, radius: 6 // The radius of the inner circle
, scale: 1.5 // Scales overall size of the spinner
, corners: 1 // Corner roundness (0..1)
, color: '#000' // #rgb or #rrggbb or array of colors
, opacity: 0.2 // Opacity of the lines
, rotate: 0 // The rotation offset
, direction: 1 // 1: clockwise, -1: counterclockwise
, speed: 1 // Rounds per second
, trail: 52 // Afterglow percentage
, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
, zIndex: 2e9 // The z-index (defaults to 2000000000)
, className: 'spinner' // The CSS class to assign to the spinner
, top: '50px' // Top position relative to parent
, left: '50%' // Left position relative to parent
, shadow: false // Whether to render a shadow
, hwaccel: false // Whether to use hardware acceleration
, position: 'absolute' // Element positioning
}
var spinner;
if (typeof Spinner !== "undefined")
    spinner = new Spinner(opts).spin();
function startSpinner(selector) {
    if(!selector)
        selector = '#roomiesContainer';
    spinner.spin();
    $(selector).append(spinner.el);
}
function stopSpinner() {
    spinner.stop();
}