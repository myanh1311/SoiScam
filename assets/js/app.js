const header = document.querySelector(".header");

window.addEventListener("scroll", () => {
    const headerHeight = header.offsetHeight;
    const marginTopHeader = parseFloat(getComputedStyle(header).marginTop);
    const totalHeaderHeight = headerHeight + marginTopHeader;
    if (window.scrollY > totalHeaderHeight) {
        header.classList.add("fixed");
        document.body.style.paddingTop = `${totalHeaderHeight}px`;
    } else{
        header.classList.remove("fixed");
        document.body.style.paddingTop = "0";
    }
})