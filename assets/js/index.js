const warningHeader = document.querySelectorAll(".warning__header");

warningHeader.forEach((item) => item.addEventListener("click", handleShowDropdown));

function handleShowDropdown(e) {
    const warningContent = e.target.nextElementSibling;
    const warningContentAll = document.querySelectorAll(".warning__content");
    const warningIcon = e.target.querySelector(".warning__header-icon");
    warningIconAll = document.querySelectorAll(".warning__header-icon");
   
    warningIconAll.forEach(item => {
        if(item !== warningIcon) {
            item.classList.remove("active");
        }
    })
   
    warningContentAll.forEach(item => {
        if(item != warningContent) {
            item.style.height = 0;
            item.classList.remove("active");
        }
    })
  
    warningContent.style.height = `${warningContent.scrollHeight}px`;
    warningContent.classList.toggle("active")
    warningIcon.classList.toggle("active");
    if (!warningContent.classList.contains("active")) {
        warningContent.style.height = 0
    }
}